import { beforeEach, describe, expect, it, vi } from "vitest";

const { users } = vi.hoisted(() => ({ users: new Map<string, any>() }));

vi.mock("@/lib/db", () => {
  const db: any = {
    user: {
      create: vi.fn(async ({ data }: any) => {
        const user = { id: "user-" + users.size, ...data, createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01") };
        users.set(data.email, user);
        return user;
      }),
      findUnique: vi.fn(async ({ where }: any) => users.get(where.email) ?? null),
    },
    workspace: {
      create: vi.fn(async ({ data }: any) => ({
        id: "workspace-" + users.size,
        name: data.name,
        ownerId: data.ownerId,
        role: "owner",
        createdAt: new Date("2026-01-01"),
      })),
    },
  };
  db.$transaction = vi.fn(async (callback: (tx: typeof db) => Promise<any>) => callback(db));
  return { db };
});

vi.mock("@/lib/server/rate-limit", () => ({ rateLimit: vi.fn() }));

vi.mock("@/lib/server/auth", () => ({
  hashPasswordWithDb: vi.fn(async (password: string) => "hash:" + password),
  publicUser: vi.fn((user: any) => ({ id: user.id, name: user.name, email: user.email })),
  sessionCookieHeader: vi.fn((token: string) => "cortex_session=" + token + "; Path=/; HttpOnly"),
  signSessionToken: vi.fn((userId: string) => "session:" + userId),
}));

import { db } from "@/lib/db";
import { POST as signup } from "@/app/api/auth/signup/route";

describe("Signup route contract", () => {
  beforeEach(() => { users.clear(); vi.clearAllMocks(); });

  it("creates user + workspace atomically and establishes a session", async () => {
    const res = await signup(new Request("http://qa.local/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "QA User", email: "qa@example.invalid", password: "Cortex-Strong-Password" }),
    }));

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.user).toEqual({ id: "user-0", name: "QA User", email: "qa@example.invalid" });
    expect(body.workspaces[0]).toMatchObject({ id: "workspace-1", name: "فضای کاری من", role: "owner" });
    expect(res.headers.get("set-cookie")).toContain("cortex_session=session:user-0");
    expect(vi.mocked(db.$transaction)).toHaveBeenCalledOnce();
  });

  it("rejects duplicate emails without opening a transaction", async () => {
    const first = await signup(new Request("http://qa.local/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "First", email: "dup@example.invalid", password: "Cortex-Strong-Password" }),
    }));
    expect(first.status).toBe(201);
    vi.clearAllMocks();

    const second = await signup(new Request("http://qa.local/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Second", email: "dup@example.invalid", password: "Cortex-Strong-Password" }),
    }));
    expect(second.status).toBe(409);
    expect(vi.mocked(db.$transaction)).not.toHaveBeenCalled();
  });
});
