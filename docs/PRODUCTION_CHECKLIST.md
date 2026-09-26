# Cortex AI — Production MVP Checklist

## Release gate

- [ ] GitHub CI is green on the exact commit being released.
- [ ] Prisma schema validation passes.
- [ ] Unit/security tests pass.
- [ ] Production database schema contract check passes.
- [ ] Worker deploy succeeds.
- [ ] Live /api/health returns HTTP 200 and does not expose provider or environment metadata.
- [ ] Auth smoke passes: signup → session → workspace.
- [ ] Agent smoke passes: create → detail → update/delete path.
- [ ] Knowledge smoke passes: upload → processing → ready.
- [ ] Unauthenticated agent access returns HTTP 401.
- [ ] API CORS preflight returns HTTP 204.
- [ ] API-key smoke passes and raw keys are shown only at creation.
- [ ] API chat returns either a real 200 completion or an explicit 503 when no LLM provider is configured; never a fabricated response.
- [ ] Workspace usage counters/events are created for successful model calls.
- [ ] Telegram webhook secret validation is enabled for every connected bot.
- [ ] Telegram bot end-to-end test is completed with a real bot token before customer launch.
- [ ] At least one real LLM provider/model is configured and tested before customer launch.

## Required production configuration

### Core
- DATABASE_URL (or POSTGRES_PRISMA_URL / POSTGRES_URL)
- APP_SECRET_KEY — at least 32 characters and persistent
- Cloudflare API token/account configuration

### AI
Configure either:
1. workspace provider settings (recommended for multi-tenant isolation), or
2. environment OpenRouter configuration.

Typical environment configuration:
- LLM_PROVIDER
- OPENROUTER_API_KEY
- LLM_MODEL

For neural embeddings, optionally configure:
- EMBEDDINGS_PROVIDER=openai
- OPENAI_API_KEY

Without an LLM provider, Cortex deliberately exposes a safe HTTP 503 instead of generating an answer from unsupported data.

## Telegram

Per bot:
- BotFather token
- Cortex bot connection
- webhook secret
- selected agent
- allowlist / user access policy

A real Telegram smoke test must verify:
1. /start
2. contact verification
3. allowlist decision
4. message → Cortex answer
5. persistent conversation
6. /newchat
7. /usage
8. retry behavior on transient Telegram/API errors

## Storage

R2 is optional for the MVP.
- PostgreSQL inline storage supports the fallback upload path for small documents.
- For production-scale knowledge files, enable Cloudflare R2 and keep the R2 credentials in Worker secrets.
- The R2 path must be used for large/durable files before raising the product upload limit.

## Security checks

- [ ] Session cookie remains HttpOnly, SameSite=Lax, Secure in production.
- [ ] API keys are hash-only at rest.
- [ ] Provider and Telegram secrets are encrypted at rest.
- [ ] Agent/workspace authorization is enforced server-side.
- [ ] Knowledge retrieval is tenant-scoped.
- [ ] External URL ingestion keeps SSRF protections enabled.
- [ ] Public health output stays minimal.
- [ ] Error responses include a request/correlation ID without leaking stack traces or secrets.
- [ ] Rate limiting is enabled on public health, chat, and API routes.

## Monitoring

Current baseline:
- Cloudflare Worker logs
- structured request IDs on server errors
- admin audit logs
- usage events
- execution records for tool/workflow runs

Recommended next production hardening:
- distributed rate limiting at the edge
- persistent error aggregation/alerting
- deployment alerts
- uptime monitoring against /api/health

## Known scaling boundaries

- Local vector search is an exact cosine scan over PostgreSQL rows. This is appropriate for an MVP/small knowledge base, not an unbounded tenant-scale vector corpus.
- In-memory rate limiting is isolate-local. Treat it as a first-layer limiter, not a global abuse-prevention system.
- Production schema currently uses prisma db push; a versioned migration history should be introduced before frequent production schema changes.

## Launch decision

Do not market Cortex as a fully live AI product until:
- a real LLM provider is configured,
- at least one real grounded question succeeds,
- one real API client succeeds,
- one real Telegram conversation succeeds,
- usage tracking is observed from those real calls,
- and the release gate above passes on the same deployed commit.
