import { describe, expect, test } from "vitest";
import { toErrorResponse } from "@/lib/server/http";

describe("HTTP error handling", () => {
  test("returns safe public errors with a correlation id", async () => {
    const response = toErrorResponse(new Error("database password=secret should never be returned"), null);
    const body = await response.json() as { error?: string; requestId?: string };

    expect(response.status).toBe(500);
    expect(body.error).toContain("خطای غیرمنتظره");
    expect(body.error).not.toContain("password=secret");
    expect(body.requestId).toMatch(/^[a-f0-9-]{20,}$/);
  });
});
