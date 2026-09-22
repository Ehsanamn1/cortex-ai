# Cortex AI — Architecture (Phase 1)

## 1. High-level design

```
┌────────────────────────────────────────────────────────────────┐
│ Browser (Persian RTL SPA at /)                                 │
│  AuthScreen · AppShell · Dashboard · Agents · Knowledge ·       │
│  Playground (chat + retrieval debug) · Conversations · Settings │
└───────────────▲────────────────────────────────────────────────┘
                │ same-origin JSON / multipart fetch
┌───────────────┴────────────────────────────────────────────────┐
│ Next.js API route handlers (src/app/api/**)                    │
│  auth · workspaces · agents · knowledge · conversations ·      │
│  chat (RAG) · dashboard · providers                            │
│  ── rate limiting · zod-style validation · CORS ──              │
├────────────────────────────────────────────────────────────────┤
│ Framework-free business modules (src/lib/**)                   │
│  server/auth      scrypt hashing, HS256 session JWT, cookies   │
│  server/access    workspace-membership authorization           │
│  knowledge/*      extract → normalize → chunk → embed → store  │
│  rag/*            prompt sections + retrieval + generation     │
│  providers/llm         LLMProvider   (workspace OpenAI-compatible | OpenRouter)        │
│  providers/embeddings  EmbeddingProvider (openai | local-lex.) │
│  providers/vector      VectorStore   (qdrant | local Postgres)   │
└───────┬───────────────────────────────┬────────────────────────┘
        │ Prisma                        │ REST (only if Qdrant configured)
┌───────┴──────────┐          ┌─────────┴─────────┐
│ PostgreSQL (Neon) │          │ Qdrant (optional)  │
└──────────────────┘          └───────────────────┘
```

The business modules under `src/lib/**` do not import Next.js — they are portable to
FastAPI/Python-service rewrites without behavioral changes; route handlers are a thin
transport layer.

## 2. Data model (prisma/schema.prisma)

```
User 1─* Workspace (owner)
User *─* Workspace via WorkspaceMember (role)
Workspace 1─* Agent
Agent 1─* KnowledgeSource (file | url; status: pending|processing|ready|failed)
KnowledgeSource 1─* KnowledgeDocument (name, mime, size, url)
KnowledgeDocument 1─* KnowledgeChunk (seq, text, page?, section?, sourceUrl?, metadata JSON)
Agent 1─* Conversation (title, user)
Conversation 1─* Message (role user|assistant|system, content, metadata JSON)
VectorPoint (id = chunk id; agentId, workspaceId, sourceId, vector JSON, payload JSON)
```

- Stable cuid IDs, timestamps, foreign keys with cascading deletes, indexes on every
  tenant-scoping column.
- `KnowledgeChunk` rows are denormalized with `agentId`/`workspaceId` for O(1) tenant
  re-verification during retrieval (defense in depth).
- `VectorPoint` is the local vector layer. With Qdrant configured, vectors live in Qdrant
  and this table stays empty.

## 3. Provider abstraction (the core extension point)

```ts
interface LLMProvider        { isConfigured(); model(); generateResponse(); healthCheck(); }
interface EmbeddingProvider  { embedText(); embedDocuments(); }   // mode: neural | lexical
interface VectorStore        { upsertPoints(); search(); deleteByAgent(); deleteBySource(); }
```

- **LLM**: `ZAIProvider` (built-in, real) and `OpenRouterProvider` (real, activated by
  `OPENROUTER_API_KEY`). `llmManager.resolve()` order: `LLM_PROVIDER` env → OpenRouter
  key presence → ZAI. If nothing is configured, status is `not_configured` and the chat
  API returns HTTP 503 with a Persian configuration error. **No fallback to fake output.**
- **Embeddings**: `OpenAIEmbeddingProvider` (any OpenAI-compatible `/embeddings` endpoint)
  and `LocalLexicalEmbeddingProvider` (real feature-hashing: Persian-aware tokenizer →
  tokens + bigrams + char-trigrams → 2048-d signed hash vector → sublinear TF → L2 norm).
  The local engine performs genuine lexical cosine retrieval and is always labeled
  `local-lexical (non-neural)` in Settings.
- **Vector store**: `QdrantVectorStore` (creates a collection with payload indexes for
  `agentId`/`workspaceId`/`sourceId`, upserts with `wait=true`, searches with a `must`
  filter on `agentId`, deletes by filter) and ``LocalVectorStore` (PostgreSQL `VectorPoint` persistence + exact in-process cosine). Both are hard-scoped per agent.

Adding a provider = implementing the interface + registering it in the manager. Business
logic never changes.

## 4. Knowledge pipeline

```
Upload (multipart) ── validate: extension + magic bytes + size cap ──┐
URL (json) ── validate: scheme allowlist, private-IP/hostname block, ┤
              DNS resolution check, redirect re-validation, timeout, │
              5 MB response cap                                     │
                                                                    ▼
  persist source+document (status: pending) → async worker:
  extract text (per page for PDF; heading sections for HTML)
  → normalize (Unicode cleanup, whitespace collapse)
  → chunk (CHUNK_SIZE/CHUNK_OVERLAP; page/section identity preserved)
  → embed (EmbeddingProvider, batched)
  → store chunks (DB) + vectors (VectorStore)
  → status: ready   (ONLY after vectors are actually stored)
  on failure → status: failed + safe Persian error (technical detail only in server logs)
```

Deletion of a source (or agent) purges chunks **and** vectors first, then cascades rows —
no orphaned knowledge is ever retrievable. Retry re-runs the same real pipeline.

## 5. RAG pipeline (per chat message)

```
question → provider gate (honest 503 if unconfigured)
         → embed question
         → VectorStore.search(agentId, topK)
         → DB re-verification of every hit (agentId + workspaceId must match)
         → min-score filter
         → [optional] bilingual LLM query expansion + per-language re-retrieval
           (only when the top score is weak — standard IR recall technique)
         → bounded prompt: system rules → agent instructions → [1..k] knowledge
           with source labels → last 12 conversation turns → question
         → LLM generation
         → persist assistant message with real sources/retrieval metadata
```

The system prompt mandates: retrieved knowledge is the primary source; unsupported facts
must never be invented; insufficient knowledge must produce the exact Persian sentence
«اطلاعات کافی در دانش فعلی برای پاسخ دقیق به این سؤال پیدا نکردم.».

## 6. Security architecture

- **Passwords**: scrypt with per-user salt, timing-safe comparison.
- **Sessions**: HS256-signed compact JWT in an `HttpOnly` `SameSite=Lax` cookie (7-day
  expiry, `Secure` flag via `COOKIE_SECURE=true` for HTTPS deployments).
- **Authorization**: every agent/knowledge/conversation route resolves the resource from
  the database and verifies the session user's workspace membership server-side. Client-
  supplied workspace/agent IDs are never trusted.
- **Tenant isolation in retrieval**: vector search is filtered by `agentId`, then every
  result is re-verified against the database (`agentId` + `workspaceId`). A user's
  retrieval cannot return another workspace's knowledge.
- **Upload safety**: extension + magic-byte validation, size cap, sanitized filenames,
  files stored outside the web root (`.data/uploads`, never served).
- **URL safety (SSRF)**: http/https only; localhost/`.local`/`.internal`/metadata hosts
  blocked; DNS-resolved IPs checked against private ranges (10/8, 172.16/12, 192.168/16,
  127/8, 169.254/16, IPv6 ULA/link-local); redirects followed manually with re-validation;
  20 s timeout; 5 MB cap.
- **Rate limiting**: in-memory sliding window (auth 10–12/min, chat 30/min, upload 20/min,
  health 6/min). Single-node foundation; swap for Redis when scaling out.
- **Error hygiene**: users only ever see safe Persian messages; stack traces, keys, and
  database details stay in server logs.

## 7. Frontend architecture

Single client-side SPA at `/` (the only user-visible route). Session gate → AuthScreen or
AppShell. View routing via Zustand (`view`, `activeAgentId`, `activeConversationId`,
`agentTab`); server state via TanStack Query (polling knowledge statuses at 2.5 s while
`pending`/`processing`). RTL Persian, Vazirmatn font, dark Cortex palette
(`#07090D` / `#11151C` / `#3B82FF` / `#8B5CF6`), desktop sidebar + mobile bottom nav
(داشبورد، ایجنت‌ها، دانش، گفتگوها، بیشتر). Source chips render only metadata actually
returned by the API — the UI never fabricates citations.

## 8. Current control plane

Telegram integration, per-user usage limits, audit logging, admin control center, analytics,
provider configuration/health checks, and plugin registry are implemented. Production file
storage uses Cloudflare R2. The current public compute target is Cloudflare Workers, with
Neon PostgreSQL as the persistent database.
