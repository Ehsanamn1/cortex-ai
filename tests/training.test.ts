import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.CORTEX_TRAINING_ENABLED = "false";
process.env.CORTEX_TRAINING_WORKER_URL = "https://trainer.example.test";
process.env.CORTEX_TRAINING_WORKER_SECRET = "trainer-secret";
process.env.CORTEX_TRAINING_CALLBACK_URL = "https://cortex.example.test/api/internal/training/callback";
process.env.CORTEX_TRAINING_CALLBACK_SECRET = "callback-secret";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    trainingJob: { findUnique: vi.fn() },
    modelAdapter: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    systemProviderConfig: { upsert: vi.fn() },
    agent: { update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

import { handleTrainingCallback, trainingConfig } from "@/lib/server/training";

describe("Cortex training feature gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps training disabled for the current release", () => {
    expect(trainingConfig.enabled).toBe(false);
    expect(trainingConfig.defaultBaseModel).toBe("Qwen/Qwen3-0.6B");
    expect(trainingConfig.minExamples).toBe(8);
    expect(trainingConfig.maxEvalLoss).toBe(2.8);
  });

  it("rejects training callbacks while training is disabled", async () => {
    await expect(handleTrainingCallback({
      jobId: "job-1",
      eval_loss: 1.2,
      samples: 64,
      artifact_path: "/models/job-1/adapter",
    })).rejects.toMatchObject({ status: 503, code: "training_disabled" });

    expect(dbMock.trainingJob.findUnique).not.toHaveBeenCalled();
  });
});
