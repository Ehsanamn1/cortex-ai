# Cortex AI — API Reference (Phase 1)

Base URL: same origin (`/api/...`). All bodies/responses are JSON unless noted.
Authentication: `cortex_session` HttpOnly cookie (set by signup/login).

**Errors** — every non-2xx response is `{ "error": "<Persian message>" }` with an
appropriate status: `400` validation · `401` unauthenticated · `403` no workspace access ·
`404` not found (or foreign tenant) · `409` conflict · `413` upload too large ·
`429` rate limited · `500` server error · `502` provider unavailable ·
`503` provider not configured.

## Auth

### POST /api/auth/signup
`{ name?, email, password }` → `201 { user, workspaces }` + session cookie.
Creates the default workspace («فضای کاری من»). Email format + password ≥ 8 chars
validated; duplicate email → `409`.

### POST /api/auth/login
`{ email, password }` → `200 { user, workspaces }` + cookie. Wrong credentials →
`401` «ایمیل یا رمز عبور نادرست است.» Rate limit: 12/min/IP.

### POST /api/auth/logout
→ `200 { ok: true }` (clears cookie).

### GET /api/auth/me
→ `200 { user: {id,name,email}, workspaces: [{id,name,role,createdAt}] }` | `401`.

## Workspaces

### GET /api/workspaces
→ `200 { workspaces: [{id, name, role, createdAt, _count: {agents}}] }`

### POST /api/workspaces
`{ name }` (2–80 chars) → `201 { workspace }`

## Agents (all scoped to the caller's memberships)

### GET /api/agents
→ `200 { agents: AgentDto[] }` — `AgentDto = { id, name, orgName, description, language,
tone, customTone, instructions, status, createdAt, updatedAt, _count:
{ knowledgeSources, conversations } }`

### POST /api/agents
`{ name, orgName?, description?, language: "fa"|"en", tone:
"professional"|"friendly"|"concise"|"formal"|"custom", customTone?, instructions?,
workspaceId? }` → `201 { agent }`. `customTone` required when `tone="custom"`.
`workspaceId` must be one of the caller's workspaces (server-verified).

### GET /api/agents/:id
→ `200 { agent: AgentDto & { _count: {…, messages}, knowledgeReady }, knowledgeReady }`
(`knowledgeReady` = at least one `ready` knowledge source — real only) | `404`.

### PATCH /api/agents/:id
Partial agent fields → `200 { agent }`.

### DELETE /api/agents/:id
→ `200 { ok: true }`. Removes the agent's knowledge sources, documents, chunks,
**vectors**, and conversations.

## Knowledge

### GET /api/agents/:id/knowledge
→ `200 { sources: [{ id, name, type: "file"|"url", status:
"pending"|"processing"|"ready"|"failed", error, chunkCount, createdAt, updatedAt,
documents: [{ id, name, status, chunkCount, url }] }] }`

### POST /api/agents/:id/knowledge
Two modes:

- **File** — `multipart/form-data` with `file` (`.pdf`, `.txt`, `.docx`; ≤
  `MAX_UPLOAD_MB`; magic bytes validated) → `202 { source }`.
- **URL** — `{ url }` (public http/https only; SSRF-guarded) → `202 { source }`.

Processing runs asynchronously; poll GET until `ready`/`failed`. Rate limit: 20/min/IP.

### DELETE /api/knowledge/:sourceId
→ `200 { ok: true }`. Deletes chunks + vectors + stored upload file.

### POST /api/knowledge/:sourceId/retry
→ `202 { source }` (status → pending; pipeline re-runs). `409` if already processing.

## Conversations

### GET /api/agents/:id/conversations
→ `200 { conversations: [{ id, title, createdAt, updatedAt, messageCount }] }`

### POST /api/agents/:id/conversations
→ `201 { conversation }` — **New Chat**. Previous conversations are preserved.

### GET /api/conversations/:id
→ `200 { conversation, agent: AgentDto, messages: [{ id, role, content, createdAt,
metadata }] }` | `404`. `metadata` (assistant messages): `{ sources:
[{index, documentName, page?, sourceUrl?}], retrieval: [{index, score, documentName,
page?, sourceUrl?, snippet}], provider, model, latencyMs }`.

### DELETE /api/conversations/:id
→ `200 { ok: true }`

### POST /api/conversations/:id/chat  ← the RAG endpoint
`{ content }` (1–4000 chars) → `200 { userMessage, assistantMessage }`.

Pipeline: persist user message → embed question → tenant-scoped vector search (top-K
`RETRIEVAL_TOP_K`, min score `MIN_SIMILARITY_SCORE`, DB re-verification) → optional
bilingual query expansion on weak scores → bounded 5-section prompt (system rules, agent
instructions, retrieved knowledge with source labels, last 12 turns, question) → LLM →
persist assistant message with real source metadata.

- `503` — LLM/embeddings not configured (honest error, no fake answer).
- `502` — provider transport failure.
- `429` — rate limit (30/min/IP).

The assistant **never** invents citations; `sources` contains only chunks actually
retrieved. Insufficient knowledge → the mandated Persian fallback sentence.

## Dashboard & providers

### GET /api/dashboard
→ `200 { stats: { agents, activeAgents, knowledgeSources, knowledgeReady,
conversations, messages }, recentAgents: [...], recentConversations: [...] }`
Real counts only — zeros stay zeros.

### GET /api/providers/status
→ `200 { llm: { provider, status, model }, embeddings: { provider, status, model,
mode: "neural"|"lexical"|null }, vectorStore: { provider: "local"|"qdrant", status } }`
Reflects live configuration — never claims a service is up when it is not.

### POST /api/providers/health
→ `200 { ok: true, llm: { provider, model, latencyMs, sample } }` — a real minimal
completion round-trip. `503`/`502` on failure.

## Verified test plan (executed against this build)

- **Signup/login/logout/me**: success paths, duplicate email `409`, wrong password `401`,
  unauthenticated `401`, rate limit `429` after 12 rapid logins.
- **Workspace bootstrap**: default workspace auto-created; lists scoped per user.
- **Tenant isolation (critical)**: user B receives `403` on user A's agent,
  conversation, and knowledge-source deletion; B's lists are empty; **B's agent cannot
  retrieve A's vectors** (cross-tenant RAG query returns the honest not-found fallback,
  sources show only B's documents).
- **Agent CRUD**: create → redirect target verified; PATCH tone; DELETE cascades and
  purges vectors (orphan checks return 0).
- **Knowledge upload**: TXT/PDF/DOCX processed to `ready` with real chunk counts
  (3-page PDF → 3 page-numbered chunks); renamed binary rejected `400`; URL ingestion
  (example.com) → `ready`; SSRF attempts (127.0.0.1, 169.254.169.254) rejected.
- **RAG**: grounded answers with correct numbers from knowledge; page-aware citations;
  out-of-knowledge question → exact fallback sentence; short-term memory across turns;
  cross-language retrieval via query expansion; provider metadata recorded.
- **Missing-provider behavior**: provider resolution returns `not_configured` and chat
  returns a real `503` configuration error when no provider is available (verified via
  the provider-resolution unit of the manager; no fake content path exists in code).
- **Deletion integrity**: after source deletion, `VectorPoint`/`KnowledgeChunk` orphan
  counts are zero.

> Note: this environment's policy excludes an executable test suite from the repository;
  the behaviors above were verified live (curl + headless browser) and are documented as
  the regression checklist for the future suite.
