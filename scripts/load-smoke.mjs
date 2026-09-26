const base = (process.env.CORTEX_BASE_URL || "https://cortex-ai.dengxiao445.workers.dev").replace(/\/$/, "");
const concurrency = Number(process.env.LOAD_CONCURRENCY || 10);
const rounds = Number(process.env.LOAD_ROUNDS || 1);
const endpoints = [
  { path: "/api/health", expected: [200] },
  { path: "/api/site-config", expected: [200] },
  { path: "/api/providers/status", expected: [401] },
  { path: "/api/settings/limits", expected: [401] },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function one(endpoint) {
  const started = performance.now();
  try {
    const res = await fetch(base + endpoint.path, { headers: { accept: "application/json" } });
    const elapsed = performance.now() - started;
    return { path: endpoint.path, status: res.status, expected: endpoint.expected, ms: elapsed };
  } catch (error) {
    return { path: endpoint.path, status: 0, expected: endpoint.expected, ms: performance.now() - started, error: String(error) };
  }
}
async function runRound() {
  const tasks = [];
  for (let i = 0; i < concurrency; i++) tasks.push(one(endpoints[i % endpoints.length]));
  return Promise.all(tasks);
}
const results = [];
for (let r = 0; r < rounds; r++) {
  results.push(...await runRound());
  await sleep(100);
}
const latencies = results.map(x => x.ms).sort((a,b)=>a-b);
const pct = p => latencies[Math.min(latencies.length-1, Math.floor(latencies.length*p))];
const failures = results.filter(x => x.status >= 500 || !x.expected?.includes(x.status));
const summary = {
  base,
  concurrency,
  rounds,
  requests: results.length,
  failures: failures.length,
  errorRate: results.length ? failures.length / results.length : 1,
  p50_ms: pct(0.50),
  p95_ms: pct(0.95),
  p99_ms: pct(0.99),
  statuses: Object.fromEntries(Object.entries(results.reduce((m,x)=>{m[x.status]=(m[x.status]||0)+1;return m},{})).sort()),
  endpointFailures: failures.slice(0,20),
};
console.log(JSON.stringify(summary, null, 2));
if (failures.length) process.exitCode = 1;
