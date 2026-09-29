import { beforeEach, describe, expect, it, vi } from "vitest";
import { configureBotProfile } from "@/lib/telegram/service";

describe("Telegram profile sync", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("syncs all Telegram profile operations in parallel", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, result: {} }),
    } as Response);

    const result = await configureBotProfile("123:token", "Cortex Test", {
      shortDescription: "کوتاه",
      description: "کامل",
      commands: [{ command: "start", description: "شروع" }],
    });

    expect(result.ok).toBe(true);
    expect(result.failures).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual(
      expect.arrayContaining([
        expect.stringContaining("/setMyName"),
        expect.stringContaining("/setMyShortDescription"),
        expect.stringContaining("/setMyDescription"),
        expect.stringContaining("/setMyCommands"),
        expect.stringContaining("/setChatMenuButton"),
      ]),
    );
  });

  it("reports non-retryable Telegram API failures instead of hiding them", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      const status = url.includes("/setMyCommands") ? 400 : 200;
      return new Response(JSON.stringify(status === 200
        ? { ok: true, result: {} }
        : { ok: false, description: "command error" }), {
        status,
        headers: { "content-type": "application/json" },
      });
    });

    const result = await configureBotProfile("123:token", "Cortex Test");

    expect(result.ok).toBe(false);
    expect(result.failures.some((item) => item.method === "setMyCommands")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
});
