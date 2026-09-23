# Cortex AI

Cortex AI is an AI knowledge-agent platform: build an agent from your own business knowledge, connect a real LLM provider, test it in a persistent playground, and expose the same agent through Telegram.

## Product

- Auth, workspaces and multi-tenant agent management
- Real knowledge ingestion for PDF, DOCX and text formats
- URL ingestion with SSRF protection and bounded downloads
- Chunking, embeddings, vector search and grounded RAG
- Persistent conversations, source-aware answers and New Chat
- Telegram bots with contact verification, allowlist/blocking, webhook or polling
- Per-user usage tracking and limits
- Admin control center, analytics, audit logs, provider settings and health checks

## Runtime architecture

- **Frontend / API:** Next.js App Router through Vinext
- **Compute:** Cloudflare Workers
- **Database:** PostgreSQL on Neon through Prisma + Neon adapter
- **Files:** Cloudflare R2 for production knowledge uploads
- **Vectors:** local Postgres-backed vector store by default, optional Qdrant
- **LLM:** workspace-level OpenAI-compatible providers with optional OpenRouter environment fallback
- **Embeddings:** OpenAI embeddings when configured, otherwise the built-in lexical engine

The Worker uses Vinext on Cloudflare Workers with the PostgreSQL Neon adapter and current Workers Node.js compatibility.

## Local development

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma db push --accept-data-loss
npm run dev
```

For the Cloudflare runtime locally:

```bash
npm run dev:vinext
```

Open `http://localhost:3000` for the standard app or the port printed by Vinext.

## Required production secrets

The Cloudflare Worker requires these secrets:

```text
DATABASE_URL
APP_SECRET_KEY
CORTEX_ADMIN_PASSWORD
```

Keep these values in Cloudflare Worker Secrets, not in the repository. The deployment workflow expects Cloudflare CI credentials:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

These are read from the GitHub Actions Environment `cortex1`. The Worker runtime secrets are separate Cloudflare Worker secrets and must exist on the target Worker before a successful production deployment.

## Cloudflare storage

Production knowledge files are stored only in the private R2 bucket:

```text
cortex-ai-knowledge
```

If the R2 binding is missing in Production, file upload fails explicitly instead of storing raw file bytes in PostgreSQL. The Worker binding is:

```text
CORTEX_KNOWLEDGE_BUCKET
```

The production upload path intentionally fails with a clear 503 when the R2 binding is absent instead of silently falling back to ephemeral local disk.

## AI provider

Cortex supports workspace-level OpenAI-compatible gateways. Configure these in **Settings → اتصال AI**. Supported auth modes are Bearer, X-API-Key and none.

Optional environment fallback:

```env
LLM_PROVIDER=
LLM_BASE_URL=
LLM_API_KEY=
LLM_MODEL=
LLM_AUTH_MODE=bearer
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
```

## Embeddings and vector search

If an OpenAI embedding key is configured, Cortex can use neural embeddings. Otherwise it falls back to the built-in deterministic lexical embedding engine.

For larger installations, set:

```env
QDRANT_URL=
QDRANT_API_KEY=
```

The local vector store remains tenant-scoped to the owning agent/workspace.

## Telegram

Create a bot from the Telegram page. Webhook mode requires a public `APP_PUBLIC_URL`. Polling mode is also supported.

The bot can require the user to share their own Telegram contact, checks the allowlist, maintains a separate session per Telegram user, and supports `/newchat`.

## Security

Provider keys, Telegram tokens and webhook secrets are encrypted at rest using `APP_SECRET_KEY`.

Knowledge URL ingestion blocks local/private targets and re-validates redirected hosts before fetching content. Downloads are size-bounded.

Never commit:
- `.env`
- API keys
- Telegram bot tokens
- database credentials
- generated runtime secret files

## CI

GitHub Actions runs Prisma validation, TypeScript type checking, ESLint and the production build on pushes to `main` and pull requests.

The Cloudflare deployment workflow builds the Worker first, validates required credentials, then deploys through Wrangler.

## Current deployment target

The production deployment target is **Cloudflare Workers**. The repository no longer depends on a platform-specific Vercel deployment configuration.
