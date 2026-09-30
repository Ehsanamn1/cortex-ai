import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.CORTEX_TRAINING_WORKER_URL = "https://trainer.example.test";
process.env.CORTEX_TRAINING_WORKER_SECRET = "trainer-secret";
process.env.CORTEX_TRAINING_CALLBACK_URL = "https://cortex.example.test/api/internal/training/callback";
process.env.CORTEX_TRAINING_CALLBACK_SECRET = "callback-secret";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    trainingJob: { findUnique: vi.fn(), update: vi.fn() },
    modelAdapter: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    systemProviderConfig: { upsert: vi.fn() },
    agent: { update: vi.fn() },
    $transaction: vi.fn(async (fn: any) => fn({
      trainingJob: {
        update: vi.fn(async ({ data }: any) => ({ id: "job-1", ...data })),
      },
      modelAdapter: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async ({ data }: any) => ({ id: "adapter-1", ...data })),
        updateMany: vi.fn(),
      },
      systemProviderConfig: { upsert: vi.fn() },
      agent: { update: vi.fn() },
    })),
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/server/secrets", () => ({ encryptSecret: vi.fn((v: string) => "enc:" + v) }));

import { handleTrainingCallback, trainingConfig } from "@/lib/server/training";

describe("Cortex real training orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires a real worker configuration", () => {
    expect(trainingConfig.defaultBaseModel).toBe("Qwen/Qwen3-0.6B");
    expect(trainingConfig.minExamples).toBe(8);
    expect(trainingConfig.maxEvalLoss).toBe(2.8);
  });

  it("rejects an underperforming model before promotion", async () => {
    dbMock.trainingJob.findUnique.mockResolvedValue({
      id: "job-1",
      agentId: "agent-1",
      workspaceId: "ws-1",
      method: "qlora",
      baseModel: "Qwen/Qwen3-0.6B",
      sampleCount: 32,
      promoted: false,
    });

    const result = await handleTrainingCallback({
      jobId: "job-1",
      eval_loss: 4.1,
      samples: 32,
      artifact_path: "/models/job-1/adapter",
    });

    expect(result.status).toBe("rejected");
    expect(result.promoted).toBe(false);
  });

  it("promotes a passed adapter and switches the agent runtime to it", async () => {
    dbMock.trainingJob.findUnique.mockResolvedValue({
      id: "job-1",
      agentId: "agent-1",
      workspaceId: "ws-1",
      method: "qlora",
      baseModel: "Qwen/Qwen3-0.6B",
      sampleCount: 64,
      promoted: false,
    });

    const result = await handleTrainingCallback({
      jobId: "job-1",
      eval_loss: 1.2,
      samples: 64,
      job_id: "job-1",
      artifact_path: "/models/job-1/adapter",
    });

    expect(result.status).toBe("completed");
    expect(dbMock.agent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "agent-1" },
        data: { modelKey: "trained:adapter-1" },
      }),
    );
  });
});
