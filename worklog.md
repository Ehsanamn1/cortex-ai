# Cortex AI — Phase 1 Worklog

Project: Cortex AI (A TRANOS Product) — multi-tenant AI Agent SaaS, Phase 1.
Goal: signup/login → workspace → agent builder → knowledge (PDF/TXT/DOCX/URL) → real chunking/embedding/vector search → RAG chat playground with sessions and source citations.

---
Task ID: 1
Agent: main (Z.ai Code)
Task: Repository inspection, SDK capability verification, architecture decisions, API contract

Work Log:
- Inspected repo: clean Next.js 16 + TS + Tailwind 4 + shadcn/ui scaffold. Unrelated dirs preserved untouched: examples/, download/, tests/ (container shell scripts), Caddyfile.
- Read package.json: zod v4, zustand, @tanstack/react-query, sonner, framer-motion, prisma 6 (SQLite), z-ai-web-dev-sdk 0.0.18 available.
- Inspected z-ai-web-dev-sdk/dist/index.d.ts: has chat.completions.create (real LLM, system/user/assistant roles). NO embeddings endpoint in SDK.
- Live-tested SDK: `zai.chat.completions.create` with system role returns real completions (CHAT_OK).
- Installed: unpdf (PDF text extraction, per-page), mammoth (DOCX), cheerio (HTML readability extraction).
- .env: added APP_SECRET_KEY, LLM_PROVIDER=zai, chunk/retrieval/upload tunables. DB: SQLite at db/custom.db via Prisma.
- Dev server already running on port 3000 (bun run dev), managed by main agent only.

Stage Summary — ARCHITECTURE DECISION RECORD (binding for all agents):

STACK ADAPTATION (sandbox environment constraints, honest equivalents — no fakes):
- Requested FastAPI/Python backend → implemented as Next.js 16 App Router API route handlers (src/app/api/**). This sandbox exposes exactly one HTTP port (3000 via gateway); a separate Python process is not reachable. Business logic is still cleanly separated in src/lib/** modules (providers, knowledge, rag) so it can be ported to FastAPI later without touching route handlers.
- Requested PostgreSQL → SQLite via Prisma 6 (sandbox has no external DB). Same Prisma schema works on PostgreSQL by switching the datasource provider. Migrations: `bun run db:push`.
- Requested Qdrant → VectorStore abstraction with TWO real adapters: (1) LocalVectorStore — vectors stored in `VectorPoint` table, real cosine-similarity search in the query layer; (2) QdrantVectorStore — full REST implementation (create collection, upsert, filtered search, delete-by-filter) used automatically when QDRANT_URL is set. Both honor agent/workspace tenant filters.
- Requested OpenRouter → LLMProvider abstraction with TWO real adapters: (1) OpenRouterProvider (real, used when OPENROUTER_API_KEY configured); (2) ZAIProvider (z-ai-web-dev-sdk — the sandbox's built-in REAL provider, verified working). ProviderManager resolves: LLM_PROVIDER env > OPENROUTER_API_KEY presence > zai. If none → status "not_configured" and chat API returns an honest 503 error. NEVER any mock/fake responses.
- Embeddings: z-ai SDK has no embeddings API, OpenRouter has none either. EmbeddingProvider abstraction with TWO real adapters: (1) OpenAIEmbeddingProvider (real neural embeddings via OPENAI_API_KEY + EMBEDDINGS_MODEL + optional EMBEDDINGS_BASE_URL, OpenAI-compatible); (2) LocalLexicalEmbeddingProvider — a REAL deterministic feature-hashing vector space (token+bigram hashing, sublinear TF weighting, L2 normalization, true cosine similarity). It performs genuine lexical retrieval and is always honestly labeled "local-lexical (non-neural)" in the UI/status API. Resolution: EMBEDDINGS_PROVIDER env > OPENAI_API_KEY presence > local-lexical. No fake vectors anywhere.

DATA MODEL (Prisma, SQLite): User, Workspace, WorkspaceMember, Agent, KnowledgeSource, KnowledgeDocument, KnowledgeChunk, Conversation, Message, VectorPoint. All with cuid ids, timestamps, FKs, indexes. Statuses for sources: pending | processing | ready | failed (ready ONLY after vectors are actually stored).

SECURITY: scrypt password hashing (timing-safe), HMAC-SHA256 signed session token in httpOnly SameSite=Lax cookie (cortex_session), server-side workspace-membership authorization on EVERY scoped endpoint (client workspace/agent ids never trusted), SSRF-guarded URL ingestion (protocol allowlist, private-IP/hostname blocking incl. DNS resolution check, redirect re-validation, timeouts, size caps), file magic-byte validation, upload size limit, in-memory sliding-window rate limiting on auth/chat/upload.

API CONTRACT (LOCKED — frontend must consume exactly this):
All errors: JSON `{ "error": "<Persian message>" }` + proper status (400/401/403/404/409/413/429/500/502/503).

AUTH:
- POST /api/auth/signup {name?, email, password} → 201 {user:{id,name,email}, workspaces:[{id,name,role}]} + sets cookie
- POST /api/auth/login {email, password} → 200 {user, workspaces} + cookie
- POST /api/auth/logout → 200 {ok:true}
- GET /api/auth/me → 200 {user, workspaces} | 401

WORKSPACES:
- GET /api/workspaces → 200 {workspaces:[{id,name,role,createdAt,_count:{agents}}]}
- POST /api/workspaces {name} → 201 {workspace:{id,name,...}}

AGENTS (scoped to memberships):
- GET /api/agents → 200 {agents:[AgentDto]}  (AgentDto: id, name, orgName, description, language, tone, customTone, instructions, status, createdAt, updatedAt, _count:{knowledgeSources, conversations})
- POST /api/agents {name, orgName?, description?, language:'fa'|'en', tone:'professional'|'friendly'|'concise'|'formal'|'custom', customTone?, instructions?} → 201 {agent:AgentDto}
- GET /api/agents/:id → 200 {agent:AgentDto & {_count:{knowledgeSources, conversations, messages}}, knowledgeReady:boolean} | 404
- PATCH /api/agents/:id (partial fields) → 200 {agent:AgentDto}
- DELETE /api/agents/:id → 200 {ok:true}  (cascades knowledge + conversations + vectors)

KNOWLEDGE:
- GET /api/agents/:id/knowledge → 200 {sources:[{id,name,type:'file'|'url',status:'pending'|'processing'|'ready'|'failed',error:string|null,chunkCount,createdAt,updatedAt,documents:[{id,name,status,chunkCount,url}]}]}
- POST /api/agents/:id/knowledge  (multipart field `file` = PDF/TXT/DOCX) OR (JSON {url}) → 202 {source}  (async processing; poll)
- DELETE /api/knowledge/:sourceId → 200 {ok:true}  (removes chunks + vectors)
- POST /api/knowledge/:sourceId/retry → 202 {source}

CONVERSATIONS:
- GET /api/agents/:id/conversations → 200 {conversations:[{id,title,createdAt,updatedAt,messageCount}]}
- POST /api/agents/:id/conversations → 201 {conversation:{id,title,agentId,...}}
- GET /api/conversations/:id → 200 {conversation, agent:AgentDto, messages:[{id,role:'user'|'assistant'|'system',content,createdAt,metadata:{sources?,retrieval?}|null}]}
- DELETE /api/conversations/:id → 200 {ok:true}
- POST /api/conversations/:id/chat {content} → 200 {userMessage:{...}, assistantMessage:{id,role:'assistant',content,createdAt,metadata:{sources:[{index,documentName,page?,sourceUrl?}], retrieval:[{index,score,documentName,page?,sourceUrl?,snippet}], provider, model, latencyMs}}}
  Errors: 503 «سرویس‌دهنده هوش مصنوعی پیکربندی نشده است...» / 502 «سرویس هوش مصنوعی در دسترس نیست...»

DASHBOARD:
- GET /api/dashboard → 200 {stats:{agents,activeAgents,knowledgeSources,knowledgeReady,conversations,messages}, recentAgents:[{id,name,updatedAt}], recentConversations:[{id,title,agentId,agentName,updatedAt}]}

PROVIDERS:
- GET /api/providers/status → 200 {llm:{provider,status:'configured'|'not_configured',model}, embeddings:{provider,status,model,mode:'neural'|'lexical'|null}, vectorStore:{provider:'local'|'qdrant',status:'ready'|'not_configured'}}
- POST /api/providers/health → 200 {ok:true,llm:{provider,model,latencyMs,sample}} | 503 {ok:false,error}

DESIGN SYSTEM (Cortex identity, dark SaaS, RTL Persian):
- bg #07090D, surface #11151C, primary #3B82FF, secondary #8B5CF6, text #F8FAFC, muted #94A3B8, border rgba(148,163,184,.12), radius .75rem, subtle glow only on primary CTAs/focus. NO indigo default, no childish AI art, restrained motion.
- html dir=rtl lang=fa, font Vazirmatn (next/font/google, subsets arabic+latin). All UI copy Persian.
- Views: AuthScreen (brand+login/signup) → AppShell (sidebar right on desktop, bottom-nav on mobile: داشبورد/ایجنت‌ها/دانش/گفتگوها/بیشتر) → Dashboard (real stats + CTA ایجاد ایجنت), Agents, AgentBuilder, AgentDetail (tabs: نمای کلی/دانش/پلی‌گراند/تنظیمات), Knowledge, Conversations, Settings (honest provider statuses).
- NO fake data anywhere: honest empty states, real statuses, source chips «منبع: x.pdf — صفحه ۴» only from real metadata.

---
Task ID: 2-a
Agent: full-stack-developer (subagent)
Task: Cortex AI frontend SPA — Persian RTL dark SaaS dashboard (all views)

Work Log:
- Read worklog.md contract; implemented complete client-side SPA.
- src/app/layout.tsx: lang=fa dir=rtl, Vazirmatn font, dark class, sonner Toaster, Cortex metadata/favicon.
- src/app/globals.css: Cortex dark palette (#07090D bg, #11151C surface, #3B82FF primary, #8B5CF6 secondary) mapped to shadcn tokens, Tailwind 4 @theme inline.
- src/app/page.tsx → CortexApp (QueryClientProvider + session gate + view router via zustand).
- Components (src/components/cortex/): store.ts, logo.tsx, format.ts (fa relative time), zod-resolver.ts, bits.tsx (shared primitives), auth-screen.tsx, app-shell.tsx (sidebar/bottom-nav/topbar), cortex-app.tsx, knowledge.tsx (KnowledgeManager + polling), playground.tsx (3-pane chat w/ sources + retrieval debug), views/: dashboard-view, agents-view, agent-form, agent-detail-view (tabs), knowledge-view, conversations-view, settings-view.
- src/lib/cortex-client.ts: typed API client matching locked contract exactly.
- Dev log confirms GET / compiles and renders 200; API calls 404 pending backend (expected).

Stage Summary:
- Frontend complete per contract; no mock/fake data; honest empty states; polling for knowledge statuses; source chips only from real metadata.
- NOTE (main agent): subagent hit tool deadline before appending worklog; main agent appended this entry on its behalf after verifying file completeness and dev-server compile status.

---
Task ID: 2-b, 3-b, 4-b, 5-b, 6-b
Agent: main (Z.ai Code)
Task: Backend — Prisma schema, auth, provider layer, knowledge pipeline, RAG, all API routes

Work Log:
- prisma/schema.prisma: User, Workspace, WorkspaceMember, Agent, KnowledgeSource, KnowledgeDocument, KnowledgeChunk, Conversation, Message, VectorPoint (cuid ids, timestamps, FKs, indexes, cascades). Pushed via bun run db:push.
- src/lib/server/: http.ts (json/cors/errors), auth.ts (scrypt hashing, HMAC-SHA256 JWT session cookie, getSession/requireSession/assertWorkspaceAccess), rate-limit.ts (sliding window), access.ts (agent-scoped authorization + serialization).
- src/lib/providers/llm/: types, zai.ts (z-ai-web-dev-sdk, REAL provider, verified), openrouter.ts (real REST), manager.ts (resolution order LLM_PROVIDER > OPENROUTER_API_KEY > zai; never mock).
- src/lib/providers/embeddings/: types, openai.ts (OpenAI-compatible REST), lexical.ts (REAL feature-hashing 2048d vectors: Persian-aware tokenizer, tokens+bigrams+trigrams, sublinear TF, L2 norm, true cosine), manager.ts.
- src/lib/providers/vector/: types (cosine), local.ts (SQLite VectorPoint + exact cosine search, tenant-scoped), qdrant.ts (full REST: collection create with payload indexes, upsert wait, filtered search, delete-by-filter), index.ts (factory + status).
- src/lib/knowledge/: extract.ts (unpdf per-page PDF, mammoth DOCX, TXT decode, SSRF-guarded URL fetch: scheme allowlist, private-host/IP blocking incl. DNS resolution, manual redirect re-validation, 20s timeout, 5MB cap, cheerio readability extraction with heading sections; magic-byte sniffing; upload persistence under .data/uploads), chunk.ts (configurable size/overlap, page/section identity preserved), pipeline.ts (pending→processing→ready|failed state machine; READY only after vectors stored; delete/retry with full vector cleanup).
- src/lib/rag/: prompt.ts (5 explicit sections: system identity+grounding rules, agent instructions, bounded top-k knowledge with source labels, windowed history ≤12, current question; Persian fallback sentence mandated), pipeline.ts (tenant-safe retrieval + DB re-verification, bilingual LLM query expansion when top score <0.3 with per-language re-retrieval merged by best score).
- API routes: auth (signup/login/logout/me), workspaces (GET/POST), agents (GET/POST), agents/[id] (GET/PATCH/DELETE w/ vector purge), agents/[id]/knowledge (GET + multipart file POST + URL POST), knowledge/[id] (DELETE), knowledge/[id]/retry (POST), agents/[id]/conversations (GET/POST), conversations/[id] (GET/DELETE), conversations/[id]/chat (POST — RAG), dashboard (GET real counts), providers/status (GET honest), providers/health (POST live LLM test).

Stage Summary:
- E2E verified via curl: signup→workspace auto-create, login, me, agent CRUD, TXT/PDF/DOCX upload (magic-byte validated, invalid binary rejected), URL ingestion (example.com → ready), SSRF blocked (127.0.0.1, 169.254.169.254), statuses pending→processing→ready honestly, page-aware PDF chunks (3 pages→3 chunks), grounded Persian answer citing correct source, honest fallback sentence for unknown questions, short-term conversation memory, cross-language retrieval via query expansion (Persian question → English DOCX), tenant isolation (B gets 403 on A's agent/conversation/knowledge; B's agent cannot retrieve A's vectors), rate limiting (429 after 12 rapid logins), source deletion leaves 0 orphan chunks/vectors, providers/status honest, provider health live 246ms.
- Dev server managed by main agent (setsid --fork to survive sessions).

---
Task ID: 7, 8, 9, 10, 11
Agent: main (Z.ai Code)
Task: Backend E2E verification, frontend integration fixes, browser verification, docs, cleanup, final report

Work Log:
- Fixed two import errors (embeddings path in knowledge/rag pipelines, type modifier in qdrant.ts); fixed `retrieval is not defined` typo in rag pipeline return.
- Dev server restart management: discovered tool-session process cleanup; stable run requires setsid --fork (reparented to init). Documented implicitly by ps state.
- Strengthened Persian response-language enforcement in RAG prompt (answer always in agent language even for foreign-language questions).
- Added real bilingual LLM query expansion: when top retrieval score < 0.3, LLM rewrites query per language; per-language re-retrieval merged by best chunk score (fixed cross-language recall: Persian question → English DOCX now retrieves, score 0.191, correct grounded Persian answer). MIN_SIMILARITY_SCORE default lowered 0.12 → 0.09 (lexical match scale).
- E2E curl verification: full auth/agent/knowledge/RAG/isolation matrix (details in docs/API.md "Verified test plan").
- Browser verification (agent-browser): auth screen RTL + sticky footer, signup → honest-zero dashboard, agent builder → detail, knowledge upload dialog → polling → «آماده» with chunk count, playground grounded answers with «منبع» chips (desktop + mobile), New Chat + conversation persistence, conversations view, settings provider statuses + live «تست اتصال» (257ms), logout confirm → AuthScreen (fixed eternal-splash bug via zustand subscribe), mobile viewport 375x812 with 5-item bottom nav + «بیشتر» sheet + mobile chat.
- Fixed: nested <li> hydration error in conversations-view (li→div), SessionGate sign-out splash bug, unused ref import.
- Docs: README.md, .env.example, docs/ARCHITECTURE.md, docs/LOCAL_SETUP.md, docs/KNOWLEDGE_PIPELINE.md, docs/API.md (incl. verified regression checklist). .gitignore: /.data/.
- Cleanup: removed all test users/agents/knowledge/vectors (PRAGMA foreign_keys=ON cascade), cleared uploads; fresh signup smoke test on pristine DB passes with 0 console errors.
- Final: bun run lint clean; dev.log clean (only stale pre-fix errors remain in history).

Stage Summary:
- Phase 1 complete: PASS WITH WARNINGS. All DoD items verified live except live-Qdrant exercise (adapter fully implemented, no Qdrant service in sandbox) and executable test suite (environment policy — verified scenarios documented instead). Stack adaptations (Next.js API routes for FastAPI, SQLite for PostgreSQL, built-in ZAI provider alongside OpenRouter) are honest equivalents preserving the required abstractions; no fake functionality anywhere.


---
## Completion pass — Phase 2 + Phase 3 hardening

### Phase 2 — Telegram + Usage
- Real Telegram Bot API integration supports bot creation, connection status, webhook mode and polling mode.
- First interaction requests the user's own Telegram contact; mismatched Telegram contact ownership is rejected.
- Workspace allowlist controls access; users can be pending, allowed or blocked.
- Telegram conversations are isolated per bot/user pair and `/newchat` creates a fresh session.
- Workspace-level message/token limits are enforced.
- Per-Telegram-user message/token usage is now recorded on `UsageEvent.telegramUserId`.
- Admin can see per-user event/token usage alongside Telegram identity/status.

### Phase 3 — SaaS Control Plane
- Admin overview exposes bots, Telegram users, agents, knowledge sources, conversations, usage events and audit logs.
- Analytics tracks real usage totals, 14-day activity, common questions and knowledge-gap/unanswered-response signals.
- Provider status and live health checks are real and never represented as connected when no provider is configured.
- Provider credentials and Telegram secrets remain encrypted at rest.
- Workspace/agent/conversation authorization remains server-side and tenant-scoped.
- GitHub Actions CI now runs Prisma generate/validate, strict TypeScript, ESLint and a production Next.js build.
- Latest full CI validation passed after the final TypeScript/lint/build fixes.
- Production deployment is Docker-ready. Railway deployment was attempted but the connected Railway workspace is currently restricted by Railway, so no public production URL was created from this environment.
