const base = (process.env.CORTEX_BASE_URL || "https://cortex-ai.dengxiao445.workers.dev").replace(/\/$/, "");

const cases = [
  { method: "GET", path: "/api/health", expected: [200], public: true },
  { method: "GET", path: "/api/site-config", expected: [200], public: true },
  { method: "GET", path: "/api", expected: [200, 404], public: true },
  { method: "GET", path: "/api/auth/me", expected: [401], public: false },
  { method: "GET", path: "/api/providers/status", expected: [401], public: false },
  { method: "GET", path: "/api/providers/health", expected: [405], public: false },
  { method: "GET", path: "/api/settings/limits", expected: [401], public: false },
  { method: "GET", path: "/api/dashboard", expected: [401], public: false },
  { method: "GET", path: "/api/agents", expected: [401], public: false },
  { method: "GET", path: "/api/workspaces", expected: [401], public: false },
  { method: "GET", path: "/api/telegram/bots", expected: [401], public: false },
  { method: "GET", path: "/api/workflows", expected: [401], public: false },
  { method: "GET", path: "/api/executions", expected: [401], public: false },
  { method: "GET", path: "/api/billing", expected: [401], public: false },
  { method: "GET", path: "/api/control-center", expected: [401], public: false },
  { method: "GET", path: "/api/control-center/resources?resource=users", expected: [401], public: false },
  { method: "GET", path: "/api/control-center/billing", expected: [401], public: false },
  { method: "GET", path: "/api/control-center/settings", expected: [401], public: false },
  { method: "GET", path: "/api/control-center/plugins", expected: [401], public: false },
  { method: "GET", path: "/api/admin/auth/me", expected: [401], public: false },
];

async function runOne(testCase) {
  const started = performance.now();
  try {
    const response = await fetch(base + testCase.path, {
      method: testCase.method,
      headers: { accept: "application/json" },
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    const ms = performance.now() - started;
    const ok = testCase.expected.includes(response.status);
    const body = await response.text();
    return {
      ...testCase,
      status: response.status,
      ok,
      ms: Number(ms.toFixed(1)),
      bodyPreview: ok ? undefined : body.slice(0, 500),
      cache: response.headers.get("cache-control") || "",
      contentType: response.headers.get("content-type") || "",
    };
  } catch (error) {
    return {
      ...testCase,
      status: 0,
      ok: false,
      ms: Number((performance.now() - started).toFixed(1)),
      error: String(error),
    };
  }
}

const results = await Promise.all(cases.map(runOne));
const failed = results.filter((result) => !result.ok);
const summary = {
  base,
  requests: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  failureRate: results.length ? failed.length / results.length : 1,
  maxLatencyMs: Math.max(...results.map((r) => r.ms)),
  publicRoutes: results.filter((r) => r.public).map((r) => ({ path: r.path, status: r.status, ok: r.ok })),
  protectedRoutes: results.filter((r) => !r.public).map((r) => ({ path: r.path, status: r.status, ok: r.ok })),
  failures: failed,
};
console.log(JSON.stringify(summary, null, 2));
if (failed.length) process.exitCode = 1;
