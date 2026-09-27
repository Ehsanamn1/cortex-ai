import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  toErrorResponse: vi.fn((error: any) =>
    new Response(JSON.stringify({ error: error?.message ?? "error" }), { status: Number(error?.status) || 500 }),
  ),
  applyCors: vi.fn((response: Response) => response),
  jsonOk: vi.fn((data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } }),
  ),
  jsonError: vi.fn((message: string, status = 400) =>
    new Response(JSON.stringify({ error: { message } }), { status, headers: { "content-type": "application/json" } }),
  ),
  readJson: vi.fn(async (req: Request) => await req.json()),
}));

vi.mock("@/lib/server/admin-auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/server/http", () => ({
  applyCors: mocks.applyCors,
  jsonOk: mocks.jsonOk,
  jsonError: mocks.jsonError,
  readJson: mocks.readJson,
  toErrorResponse: mocks.toErrorResponse,
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: { findMany: vi.fn() },
    workspace: { findMany: vi.fn() },
    agent: { findMany: vi.fn() },
    knowledgeSource: { findMany: vi.fn() },
    conversation: { findMany: vi.fn() },
    telegramBot: { findMany: vi.fn(), update: vi.fn() },
    providerConfig: { findMany: vi.fn(), update: vi.fn() },
    agentProviderConfig: { findMany: vi.fn(), update: vi.fn() },
    workflow: { findMany: vi.fn() },
    execution: { findMany: vi.fn() },
    auditLog: { findMany: vi.fn() },
    plugin: { findMany: vi.fn(), update: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import { GET as getResources } from "@/app/api/control-center/resources/route";

describe("Control Center admin API contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockReturnValue("ehsan86");
  });

  it("redacts provider secrets while retaining configuration state", async () => {
    vi.mocked(db.providerConfig.findMany).mockResolvedValue([
      {
        id: "provider-1",
        workspaceId: "ws-1",
        providerName: "OpenRouter",
        baseUrl: "https://example.invalid",
        model: "model",
        authMode: "bearer",
        enabled: true,
        apiKeyEncrypted: "SUPER-SECRET",
        updatedAt: new Date(),
        workspace: { id: "ws-1", name: "Workspace" },
      },
    ] as never);
    vi.mocked(db.agentProviderConfig.findMany).mockResolvedValue([
      {
        id: "agent-provider-1",
        agentId: "agent-1",
        workspaceId: "ws-1",
        providerName: "Custom",
        baseUrl: "https://custom.invalid",
        model: "custom-model",
        protocol: "openai-compatible",
        authMode: "bearer",
        enabled: true,
        apiKeyEncrypted: "ANOTHER-SECRET",
        updatedAt: new Date(),
        agent: { id: "agent-1", name: "Agent" },
        workspace: { id: "ws-1", name: "Workspace" },
      },
    ] as never);

    const response = await getResources(
      new Request("https://cortex.test/api/control-center/resources?resource=providers"),
    );
    const body = await response.json() as { items: Array<Record<string, unknown>> };

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(2);
    expect(body.items[0].configured).toBe(true);
    expect(body.items[0]).not.toHaveProperty("apiKeyEncrypted");
    expect(body.items[1]).not.toHaveProperty("apiKeyEncrypted");
  });

  it("rejects unknown resource names before database access", async () => {
    const response = await getResources(
      new Request("https://cortex.test/api/control-center/resources?resource=secrets"),
    );
    expect(response.status).toBe(400);
    expect(vi.mocked(db.user.findMany)).not.toHaveBeenCalled();
    expect(vi.mocked(db.providerConfig.findMany)).not.toHaveBeenCalled();
  });

  it("returns 401 when admin session validation fails", async () => {
    const error = new Error("نشست مدیریت معتبر نیست.");
    Object.assign(error, { status: 401 });
    mocks.requireAdmin.mockImplementation(() => { throw error; });

    const response = await getResources(
      new Request("https://cortex.test/api/control-center/resources?resource=users"),
    );
    expect(response.status).toBe(401);
    expect(mocks.toErrorResponse).toHaveBeenCalled();
  });
});
