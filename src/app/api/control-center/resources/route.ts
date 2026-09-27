import { db } from "@/lib/db";
import { applyCors, jsonError, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/admin-auth";

export const dynamic = "force-dynamic";

const RESOURCES = new Set([
  "users",
  "workspaces",
  "agents",
  "knowledge",
  "conversations",
  "telegram",
  "providers",
  "workflows",
  "executions",
  "audit",
  "plugins",
]);

function limitValue(value: string | null) {
  const n = Number(value ?? 50);
  return Number.isFinite(n) ? Math.min(100, Math.max(1, Math.floor(n))) : 50;
}

export async function GET(req: Request) {
  try {
    requireAdmin(req);
    const url = new URL(req.url);
    const resource = url.searchParams.get("resource") ?? "users";
    const limit = limitValue(url.searchParams.get("limit"));
    if (!RESOURCES.has(resource)) return applyCors(jsonError("منبع مدیریتی نامعتبر است.", 400), req.headers.get("origin"));

    switch (resource) {
      case "users": {
        const rows = await db.user.findMany({
          take: limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true, email: true, name: true, createdAt: true, updatedAt: true,
            _count: { select: { memberships: true, ownedWorkspaces: true, conversations: true, usageEvents: true } },
          },
        });
        return applyCors(jsonOk({ resource, items: rows }), req.headers.get("origin"));
      }
      case "workspaces": {
        const rows = await db.workspace.findMany({
          take: limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true, name: true, ownerId: true, createdAt: true, updatedAt: true,
            owner: { select: { id: true, name: true, email: true } },
            _count: { select: { members: true, agents: true, telegramBots: true, workflows: true, conversations: true } },
            billingAccount: { select: { balanceCredits: true, status: true, enforcementEnabled: true, plan: { select: { key: true, name: true } } } },
          },
        });
        return applyCors(jsonOk({ resource, items: rows }), req.headers.get("origin"));
      }
      case "agents": {
        const rows = await db.agent.findMany({
          take: limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true, workspaceId: true, name: true, orgName: true, language: true, tone: true,
            maxTokens: true, memoryEnabled: true, citationsEnabled: true, status: true,
            createdAt: true, updatedAt: true,
            workspace: { select: { id: true, name: true } },
            providerConfig: { select: { providerName: true, model: true, enabled: true, apiKeyEncrypted: true } },
            _count: { select: { knowledgeSources: true, conversations: true, telegramBots: true, workflows: true, executions: true } },
          },
        });
        return applyCors(jsonOk({
          resource,
          items: rows.map(({ providerConfig, ...row }) => ({
            ...row,
            providerConfig: providerConfig
              ? { providerName: providerConfig.providerName, model: providerConfig.model, enabled: providerConfig.enabled, configured: Boolean(providerConfig.apiKeyEncrypted) }
              : null,
          })),
        }), req.headers.get("origin"));
      }
      case "knowledge": {
        const rows = await db.knowledgeSource.findMany({
          take: limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true, agentId: true, name: true, type: true, status: true, error: true, createdAt: true, updatedAt: true,
            agent: { select: { id: true, name: true, workspace: { select: { id: true, name: true } } } },
            _count: { select: { documents: true } },
          },
        });
        return applyCors(jsonOk({ resource, items: rows }), req.headers.get("origin"));
      }
      case "conversations": {
        const rows = await db.conversation.findMany({
          take: limit,
          orderBy: { updatedAt: "desc" },
          select: {
            id: true, title: true, channel: true, externalUserId: true, createdAt: true, updatedAt: true,
            agent: { select: { id: true, name: true, workspace: { select: { id: true, name: true } } } },
            user: { select: { id: true, name: true, email: true } },
            telegramBot: { select: { id: true, name: true, username: true } },
            _count: { select: { messages: true } },
          },
        });
        return applyCors(jsonOk({ resource, items: rows }), req.headers.get("origin"));
      }
      case "telegram": {
        const rows = await db.telegramBot.findMany({
          take: limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true, workspaceId: true, agentId: true, name: true, username: true, status: true, mode: true,
            lastError: true, lastSeenAt: true, lastUpdateId: true, createdAt: true, updatedAt: true,
            workspace: { select: { id: true, name: true } },
            agent: { select: { id: true, name: true } },
            _count: { select: { users: true, conversations: true, processedUpdates: true } },
          },
        });
        return applyCors(jsonOk({ resource, items: rows }), req.headers.get("origin"));
      }
      case "providers": {
        const [workspaceProviders, agentProviders] = await Promise.all([
          db.providerConfig.findMany({
            take: limit,
            orderBy: { updatedAt: "desc" },
            select: { id: true, workspaceId: true, providerName: true, baseUrl: true, model: true, authMode: true, enabled: true, apiKeyEncrypted: true, updatedAt: true, workspace: { select: { id: true, name: true } } },
          }),
          db.agentProviderConfig.findMany({
            take: limit,
            orderBy: { updatedAt: "desc" },
            select: { id: true, agentId: true, workspaceId: true, providerName: true, baseUrl: true, model: true, protocol: true, authMode: true, enabled: true, apiKeyEncrypted: true, updatedAt: true, agent: { select: { id: true, name: true } }, workspace: { select: { id: true, name: true } } },
          }),
        ]);
        return applyCors(jsonOk({
          resource,
          items: [
            ...workspaceProviders.map((x) => ({ scope: "workspace", ...x, configured: Boolean(x.apiKeyEncrypted), apiKeyEncrypted: undefined })),
            ...agentProviders.map((x) => ({ scope: "agent", ...x, configured: Boolean(x.apiKeyEncrypted), apiKeyEncrypted: undefined })),
          ],
        }), req.headers.get("origin"));
      }
      case "workflows": {
        const rows = await db.workflow.findMany({
          take: limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true, workspaceId: true, agentId: true, name: true, description: true, status: true, createdAt: true, updatedAt: true,
            workspace: { select: { id: true, name: true } },
            agent: { select: { id: true, name: true } },
            _count: { select: { triggers: true, executions: true } },
          },
        });
        return applyCors(jsonOk({ resource, items: rows }), req.headers.get("origin"));
      }
      case "executions": {
        const rows = await db.execution.findMany({
          take: limit,
          orderBy: { startedAt: "desc" },
          select: {
            id: true, workspaceId: true, agentId: true, workflowId: true, triggerType: true, status: true,
            input: true, output: true, error: true, startedAt: true, completedAt: true,
            workspace: { select: { id: true, name: true } },
            agent: { select: { id: true, name: true } },
            workflow: { select: { id: true, name: true } },
            _count: { select: { steps: true } },
          },
        });
        return applyCors(jsonOk({ resource, items: rows }), req.headers.get("origin"));
      }
      case "audit": {
        const rows = await db.auditLog.findMany({
          take: limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true, workspaceId: true, userId: true, action: true, entityType: true, entityId: true, metadata: true, createdAt: true,
            workspace: { select: { id: true, name: true } },
            user: { select: { id: true, name: true, email: true } },
          },
        });
        return applyCors(jsonOk({ resource, items: rows }), req.headers.get("origin"));
      }
      case "plugins": {
        const rows = await db.plugin.findMany({
          take: limit,
          orderBy: { createdAt: "desc" },
          select: { id: true, key: true, name: true, description: true, version: true, enabled: true, createdAt: true, updatedAt: true },
        });
        return applyCors(jsonOk({ resource, items: rows }), req.headers.get("origin"));
      }
      default:
        return applyCors(jsonError("منبع مدیریتی پشتیبانی نمی‌شود.", 400), req.headers.get("origin"));
    }
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const admin = requireAdmin(req);
    const body = await readJson<{ resource?: unknown; id?: unknown; enabled?: unknown; status?: unknown }>(req);
    const resource = typeof body.resource === "string" ? body.resource : "";
    const id = typeof body.id === "string" ? body.id : "";
    if (!id || !RESOURCES.has(resource)) return applyCors(jsonError("منبع و شناسه برای ویرایش معتبر نیست.", 400), req.headers.get("origin"));

    if (resource === "agents" && typeof body.status === "string") {
      const value = body.status.trim().slice(0, 32);
      const agent = await db.agent.update({ where: { id }, data: { status: value } });
      return applyCors(jsonOk({ admin, resource, item: agent }), req.headers.get("origin"));
    }

    if (resource === "providers" && typeof body.enabled === "boolean") {
      const scope = body.status === "agent" ? "agent" : "workspace";
      if (scope === "agent") {
        const provider = await db.agentProviderConfig.update({ where: { id }, data: { enabled: body.enabled } });
        return applyCors(jsonOk({ admin, resource, item: provider }), req.headers.get("origin"));
      }
      const provider = await db.providerConfig.update({ where: { id }, data: { enabled: body.enabled } });
      return applyCors(jsonOk({ admin, resource, item: provider }), req.headers.get("origin"));
    }

    if (resource === "plugins" && typeof body.enabled === "boolean") {
      const plugin = await db.plugin.update({ where: { id }, data: { enabled: body.enabled } });
      return applyCors(jsonOk({ admin, resource, item: plugin }), req.headers.get("origin"));
    }

    if (resource === "telegram" && typeof body.status === "string") {
      const value = body.status.trim().slice(0, 32);
      const bot = await db.telegramBot.update({ where: { id }, data: { status: value } });
      return applyCors(jsonOk({ admin, resource, item: bot }), req.headers.get("origin"));
    }

    return applyCors(jsonError("این منبع فقط خواندنی است یا فیلد ویرایش‌شده مجاز نیست.", 405), req.headers.get("origin"));
  } catch (error) {
    return toErrorResponse(error);
  }
}
