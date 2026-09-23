import { db } from "@/lib/db";
import { getVectorStore, type SearchResult } from "@/lib/providers/vector";
import { embeddingManager } from "@/lib/providers/embeddings/manager";
import { llmManager } from "@/lib/providers/llm/manager";
import { ProviderNotConfiguredError, type ChatTurn } from "@/lib/providers/llm/types";
import { buildRagMessages, type RetrievedChunk } from "./prompt";
import { estimateTokens } from "@/lib/server/audit";

export interface RagAnswer {
  content: string;
  provider: string;
  model: string;
  latencyMs: number;
  retrieval: RetrievedChunk[];
  auxiliaryInputTokens?: number;
  auxiliaryOutputTokens?: number;
}

export const RAG_QUERY_EXPANSION_RESERVE_TOKENS = 384;

export class RagConfigError extends Error {
  status = 503;
  constructor(message: string) {
    super(message);
  }
}

export function topK(): number {
  const n = Number(process.env.RETRIEVAL_TOP_K);
  return Number.isFinite(n) && n >= 1 ? Math.min(20, Math.floor(n)) : 5;
}

function minScore(): number {
  const n = Number(process.env.MIN_SIMILARITY_SCORE);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : 0.09;
}

/**
 * RAG pipeline: question → embed → tenant-scoped vector search →
 * top relevant chunks → bounded context builder → LLM → grounded answer.
 */
export async function answerWithKnowledge(params: {
  agentId: string;
  workspaceId: string;
  persona: {
    name: string;
    orgName?: string | null;
    language: string;
    tone: string;
    customTone?: string | null;
    instructions?: string | null;
    persona?: string | null;
    systemPrompt?: string | null;
    temperature?: number;
    maxTokens?: number;
    memoryEnabled?: boolean;
    citationsEnabled?: boolean;
  };
  history: Array<{ role: "user" | "assistant"; content: string }>;
  question: string;
}): Promise<RagAnswer> {
  const { agentId, workspaceId, persona, history, question } = params;

  // 1) Provider gate — honest failure, never a fake answer.
  const { provider: llm } = await llmManager.resolveForWorkspace(workspaceId);
  if (!llm) {
    throw new RagConfigError(
      "سرویس‌دهنده هوش مصنوعی پیکربندی نشده است. لطفاً از صفحه تنظیمات، وضعیت سرویس‌ها را بررسی کنید."
    );
  }

  // 2) Retrieval (only if the agent actually has knowledge)
  const chunkCount = await db.knowledgeChunk.count({
    where: { agentId, source: { status: "ready" } },
  });
  let searchResults: SearchResult[] = [];
  let auxiliaryInputTokens = 0;
  let auxiliaryOutputTokens = 0;
  if (chunkCount > 0) {
    const embedder = embeddingManager.resolve();
    if (embedder) {
      try {
        const runTenantSafeSearch = async (query: string): Promise<SearchResult[]> => {
          const queryVector = await embedder!.embedText(query);
          const store = getVectorStore();
          const results = await store.search(agentId, queryVector, topK());
          // Defense in depth: re-verify every hit belongs to this agent's workspace.
          const allowedIds = new Set(
            (
              await db.knowledgeChunk.findMany({
                where: {
                  id: { in: results.map((r) => r.id) },
                  agentId,
                  workspaceId,
                  source: { status: "ready" },
                },
                select: { id: true },
              })
            ).map((c) => c.id)
          );
          return results.filter(
            (r) => allowedIds.has(r.id) && r.score >= minScore() && (r.payload?.text?.length ?? 0) > 0
          );
        };

        searchResults = await runTenantSafeSearch(question);

        // Real query expansion for weak lexical matches: the LLM rewrites the
        // query bilingually and we re-retrieve PER LANGUAGE (a mixed-language
        // single vector dilutes scores), merging by best chunk score. This is
        // standard IR practice — no fabricated vectors, just better recall
        // (e.g. a Persian question against English documents).
        const best = searchResults[0]?.score ?? 0;
        if (best < 0.3) {
          try {
            const expansionMessages: ChatTurn[] = [
              {
                role: "system",
                content:
                  "You rewrite search queries for a keyword-based knowledge search. Output ONLY one line: the query rewritten in English, then the character |, then the query rewritten in Persian. Keep key terms and numbers. No explanations.",
              },
              { role: "user", content: question.slice(0, 500) },
            ];
            const expansion = await llm.generateResponse({
              messages: expansionMessages,
              temperature: 0,
              maxTokens: 120,
            });
            auxiliaryInputTokens += expansionMessages.reduce((sum, item) => sum + estimateTokens(item.content), 0);
            auxiliaryOutputTokens += estimateTokens(expansion.content);
            const parts = expansion.content
              .split("|")
              .map((s) => s.trim())
              .filter((s) => s.length > 3)
              .slice(0, 2);
            const byId = new Map<string, SearchResult>();
            for (const r of searchResults) byId.set(r.id, r);
            for (const part of parts) {
              const second = await runTenantSafeSearch(part);
              for (const r of second) {
                const prev = byId.get(r.id);
                if (!prev || prev.score < r.score) byId.set(r.id, r);
              }
            }
            searchResults = [...byId.values()].sort((a, b) => b.score - a.score).slice(0, topK());
          } catch (e) {
            console.warn("[cortex][rag] query expansion skipped:", e instanceof Error ? e.message : e);
          }
        }
      } catch (e) {
        console.error("[cortex][rag] retrieval failed:", e instanceof Error ? e.message : e);
        // Retrieval failure must not be silently ignored — surface a config error.
        throw new RagConfigError(
          "بازیابی از پایگاه دانش با خطا مواجه شد. لطفاً وضعیت سرویس‌ها را در تنظیمات بررسی کنید."
        );
      }
    }
  }

  const retrieved: RetrievedChunk[] = searchResults.map((r, i) => ({
    index: i + 1,
    documentName: r.payload?.documentName ?? "—",
    page: r.payload?.page ?? null,
    sourceUrl: r.payload?.sourceUrl ?? null,
    text: r.payload?.text ?? "",
    score: r.score,
  }));

  // 3) Prompt + generation
  const effectiveHistory = persona.memoryEnabled === false ? [] : history;
  const messages: ChatTurn[] = buildRagMessages({ persona, retrieved, history: effectiveHistory, question });
  const started = Date.now();
  let completion;
  try {
    completion = await llm.generateResponse({
      messages,
      temperature: typeof persona.temperature === "number" ? persona.temperature : 0.3,
      maxTokens: typeof persona.maxTokens === "number" ? persona.maxTokens : 900,
    });
  } catch (e) {
    if (e instanceof ProviderNotConfiguredError) {
      throw new RagConfigError(
        "سرویس‌دهنده هوش مصنوعی پیکربندی نشده است. لطفاً از صفحه تنظیمات، وضعیت سرویس‌ها را بررسی کنید."
      );
    }
    throw e;
  }

  return {
    content: completion.content,
    provider: completion.provider,
    model: completion.model,
    latencyMs: Date.now() - started,
    retrieval: retrieved,
    auxiliaryInputTokens,
    auxiliaryOutputTokens,
  };
}

/** Source references actually available in metadata — never fabricated. */
export function toSourceRefs(retrieved: RetrievedChunk[]) {
  return retrieved.map((r) => ({
    index: r.index,
    documentName: r.documentName,
    page: r.page ?? null,
    sourceUrl: r.sourceUrl ?? null,
  }));
}

export function toRetrievalDebug(retrieved: RetrievedChunk[]) {
  return retrieved.map((r) => ({
    index: r.index,
    score: Math.round(r.score * 1000) / 1000,
    documentName: r.documentName,
    page: r.page ?? null,
    sourceUrl: r.sourceUrl ?? null,
    snippet: r.text.slice(0, 220),
  }));
}
