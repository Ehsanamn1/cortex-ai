import { beforeEach, describe, expect, it, vi } from "vitest";
import { reserveUsageWithinLimits } from "@/lib/server/usage";

const state = vi.hoisted(() => ({
  policy: null as any,
  create: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    usagePolicy: { findUnique: vi.fn() },
    telegramUser: { findUnique: vi.fn() },
    $transaction: vi.fn(async (callback: any) => callback({
      $executeRaw: vi.fn(async () => undefined),
      usageReservation: {
        deleteMany: vi.fn(async () => undefined),
        aggregate: vi.fn(async () => ({ _sum: { tokens: 0, messages: 0 } })),
        create: state.create,
      },
      usagePolicy: { findUnique: vi.fn(async () => state.policy) },
      telegramUser: { findUnique: vi.fn(async () => null) },
      usageEvent: {
        aggregate: vi.fn(async () => ({ _sum: { totalTokens: 0 }, _count: { _all: 0 } })),
      },
    })),
  },
}));

import { db } from "@/lib/db";

describe("plan-managed usage reservations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.policy = {
      dailyMessageLimit: 0,
      monthlyMessageLimit: 1000,
      dailyTokenLimit: 0,
      monthlyTokenLimit: 1000,
      planManaged: true,
    };
    vi.mocked(db.usagePolicy.findUnique).mockResolvedValue(state.policy as never);
    state.create.mockResolvedValue({ id: "reservation" });
  });

  it("caps a Trial reservation to the canonical output budget", async () => {
    const id = await reserveUsageWithinLimits("ws", 1, 20, 1200);
    expect(id).toBe("reservation");
    expect(state.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tokens: 532 }),
    }));
  });

  it("does not cap a manually managed quota", async () => {
    state.policy = {
      dailyMessageLimit: 0,
      monthlyMessageLimit: 1000,
      dailyTokenLimit: 0,
      monthlyTokenLimit: 5000,
      planManaged: false,
    };
    vi.mocked(db.usagePolicy.findUnique).mockResolvedValue(state.policy as never);
    const id = await reserveUsageWithinLimits("ws", 1, 20, 1200);
    expect(id).toBe("reservation");
    expect(state.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tokens: 1220 }),
    }));
  });
});
