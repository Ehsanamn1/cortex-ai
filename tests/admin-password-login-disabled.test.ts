import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/admin/auth/login/route";

describe("legacy admin password login", () => {
  it("is permanently disabled", async () => {
    const response = await POST(new Request("https://cortex.test/api/admin/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "anything", password: "anything" }),
    }));
    expect(response.status).toBe(410);
    expect((await response.json()).error).toBe("ورود با نام کاربری و رمز عبور غیرفعال است؛ فقط از لینک خصوصی مالک سیستم استفاده کنید.");
  });
});
