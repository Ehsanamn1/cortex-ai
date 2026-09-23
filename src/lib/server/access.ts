import { db } from "@/lib/db";
import type { Agent } from "@/generated/prisma/client";
import { assertWorkspaceAccess, type SessionContext } from "./auth";

/**
 * Server-side authorization for agent-scoped resources. The client's
 * workspace/agent IDs are never trusted: we load the agent from the DB and
 * verify the session user is a member of the agent's workspace.
 */
export async function loadAgentForSession(
  session: SessionContext,
  agentId: string
): Promise<Agent> {
  const agent = await db.agent.findUnique({ where: { id: agentId } });
  if (!agent) {
    const err = new Error("ایجنتی با این شناسه یافت نشد.");
    (err as Error & { status?: number }).status = 404;
    throw err;
  }
  assertWorkspaceAccess(session, agent.workspaceId);
  return agent;
}

/** Loads any agent of the session user's workspaces by id (for cross-view lists). */
export function agentFilterForSession(session: SessionContext) {
  return { workspaceId: { in: session.memberships.map((m) => m.workspaceId) } };
}

export function serializeAgent(agent: Agent, counts: { knowledgeSources: number; conversations: number; messages?: number }, knowledgeReady?: boolean) {
  return {
    id: agent.id,
    name: agent.name,
    orgName: agent.orgName,
    description: agent.description,
    language: agent.language as "fa" | "en",
    tone: agent.tone as "professional" | "friendly" | "concise" | "formal" | "custom",
    customTone: agent.customTone,
    instructions: agent.instructions,
    persona: agent.persona,
    systemPrompt: agent.systemPrompt,
    temperature: agent.temperature,
    topP: agent.topP,
    maxTokens: agent.maxTokens,
    memoryEnabled: agent.memoryEnabled,
    citationsEnabled: agent.citationsEnabled,
    status: agent.status,
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
    _count: {
      knowledgeSources: counts.knowledgeSources,
      conversations: counts.conversations,
      ...(counts.messages !== undefined ? { messages: counts.messages } : {}),
    },
    ...(knowledgeReady !== undefined ? { knowledgeReady } : {}),
  };
}
