import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    agent: { findFirst: vi.fn() },
    execution: { create: vi.fn(), update: vi.fn() },
    executionStep: { create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/providers/llm/manager", () => ({
  llmManager: {
    resolveForAgent: vi.fn(),
  },
}));

vi.mock("@/lib/runtime/tools", () => ({
  listAgentTools: vi.fn(),
  executeTool: vi.fn(),
}));

vi.mock("@/lib/runtime/memory", () => ({
  loadAgentMemory: vi.fn(async () => []),
  remember: vi.fn(async () => undefined),
  rememberExplicitUserFacts: vi.fn(async () => 0),
}));

vi.mock("@/lib/rag/pipeline", () => ({
  answerWithKnowledge: vi.fn(),
}));

import { db } from "@/lib/db";
import { llmManager } from "@/lib/providers/llm/manager";
import { listAgentTools, executeTool } from "@/lib/runtime/tools";
import { answerWithKnowledge } from "@/lib/rag/pipeline";
import { runAgentExecution } from "@/lib/runtime/engine";

const agent = {
  id: "agent-journey",
  workspaceId: "workspace-journey",
  status: "active",
  name: "Journey Agent",
  systemPrompt: "You are a test agent.",
  instructions: "Be precise.",
  persona: "friendly",
  temperature: 0.2,
  maxTokens: 256,
  memoryEnabled: true,
};

describe("Cortex end-to-end agent runtime journey simulation", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(db.agent.findFirst).mockResolvedValue(agent as never);
    vi.mocked(llmManager.resolveForAgent).mockResolvedValue({
      provider: {
        name: "Journey Provider",
        model: () => "journey-model",
        isConfigured: () => true,
        healthCheck: vi.fn(async () => ({ ok: true as const, latencyMs: 1, sample: "OK" })),
        generateResponse: vi.fn(async () => ({ content: "پاسخ نهایی", provider: "Journey Provider", model: "journey-model" })),
      },
      status: { provider: "Journey Provider", status: "configured", model: "journey-model", source: "agent" },
    } as never);
    vi.mocked(db.execution.create).mockResolvedValue({ id: "exec-journey" } as never);
    vi.mocked(db.execution.update).mockResolvedValue({} as never);
    vi.mocked(db.executionStep.create).mockImplementation(async ({ data }: any) => ({ id: "step-" + data.seq } as never));
    vi.mocked(db.executionStep.update).mockResolvedValue({} as never);

    vi.mocked(listAgentTools).mockResolvedValue([]);
    vi.mocked(answerWithKnowledge).mockResolvedValue({
      content: "پاسخ دانش‌محور",
      provider: "Journey Provider",
      model: "journey-model",
      latencyMs: 8,
      retrieval: [],
      auxiliaryInputTokens: 0,
      auxiliaryOutputTokens: 0,
    } as never);
  });

  test("runs the user message through the canonical no-tool runtime path", async () => {
    const progress: string[] = [];

    const result = await runAgentExecution({
      agentId: agent.id,
      workspaceId: agent.workspaceId,
      conversationId: "conv-journey",
      memorySubjectKey: "web:user-1",
      input: "سلام",
      history: [],
      onProgress: async (message) => { progress.push(message); },
    });

    expect(result.content).toBe("پاسخ دانش‌محور");
    expect(result.provider).toBe("Journey Provider");
    expect(result.model).toBe("journey-model");
    expect(result.executionId).toBe("exec-journey");
    expect(result.toolUsed).toBeNull();
    expect(vi.mocked(answerWithKnowledge)).toHaveBeenCalledOnce();
    expect(progress.length).toBeGreaterThanOrEqual(1);
    expect(db.execution.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "exec-journey" },
      data: expect.objectContaining({ status: "COMPLETED" }),
    }));
  });

  test("challanges the tool loop: model plans a tool call, receives its result, then finalizes", async () => {
    const plannedToolCall = JSON.stringify({
      type: "tool_call",
      tool: "calculator",
      arguments: { expression: "2 + 2" },
    });

    const scriptedProvider = {
      name: "Journey Provider",
      model: () => "journey-model",
      isConfigured: () => true,
      healthCheck: vi.fn(async () => ({ ok: true as const, latencyMs: 1, sample: "OK" })),
      generateResponse: vi.fn()
        .mockResolvedValueOnce({
          content: plannedToolCall,
          provider: "Journey Provider",
          model: "journey-model",
        })
        .mockResolvedValueOnce({
          content: "نتیجه محاسبه ۴ است.",
          provider: "Journey Provider",
          model: "journey-model",
        }),
    };

    vi.mocked(llmManager.resolveForAgent).mockResolvedValue({
      provider: scriptedProvider,
      status: { provider: "Journey Provider", status: "configured", model: "journey-model", source: "agent" },
    } as never);

    vi.mocked(listAgentTools).mockResolvedValue([{
      id: "tool-calculator",
      key: "calculator",
      name: "ماشین حساب",
      description: "محاسبات",
      inputSchema: JSON.stringify({ type: "object" }),
      permissions: "READ",
      kind: "builtin",
    }] as never);

    vi.mocked(executeTool).mockResolvedValue({
      ok: true,
      output: 4,
    } as never);

    const result = await runAgentExecution({
      agentId: agent.id,
      workspaceId: agent.workspaceId,
      conversationId: "conv-tools",
      memorySubjectKey: "web:user-2",
      input: "۲+۲ چند می‌شود؟",
      history: [],
    });

    expect(result.content).toBe("نتیجه محاسبه ۴ است.");
    expect(result.toolUsed).toBe("calculator");
    expect(scriptedProvider.generateResponse).toHaveBeenCalledTimes(2);
    expect(executeTool).toHaveBeenCalledWith(
      expect.objectContaining({ key: "calculator" }),
      { expression: "2 + 2" },
      expect.objectContaining({
        workspaceId: agent.workspaceId,
        agentId: agent.id,
        conversationId: "conv-tools",
        executionId: "exec-journey",
      }),
    );
    expect(db.executionStep.create).toHaveBeenCalledTimes(3);
    expect(db.execution.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "exec-journey" },
      data: expect.objectContaining({
        status: "COMPLETED",
        metadata: expect.stringContaining("calculator"),
      }),
    }));
  });
});
