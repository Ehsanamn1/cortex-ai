# Cortex AI

Cortex AI is a multi-tenant AI knowledge-agent SaaS: create an agent, give it company knowledge, configure its behavior, test it in a persistent playground, and expose the same agent through authenticated APIs and Telegram.

## MVP scope

The current MVP focuses on three active capabilities:

- **Company Brain:** PDF, DOCX, XLSX, PPTX and a broad set of text/data/code formats, plus public URL ingestion, chunking, embeddings, tenant-scoped retrieval and grounded answers.
- **Agent Studio:** agent persona, language, tone, instructions, model settings, memory and citation controls.
- **Business Operations:** usage limits, Telegram access controls, analytics, audit logs, provider health, API keys and an OpenAI-compatible chat endpoint.

Advanced roadmap capabilities remain intentionally out of the active MVP path until the core is stable.

## Runtime architecture

- **App + API:** Next.js App Router through Vinext.
- **Compute:** Cloudflare Workers.
- **Database:** PostgreSQL on Neon through Prisma + Neon adapter.
- **Knowledge files (production):** private Cloudflare R2 through S3-compatible presigned requests. Raw upload bytes do not pass through the Worker in the normal flow.
- **Knowledge files (local/development):** a small PostgreSQL `db64://` fallback remains available only outside production when R2 is unavailable.
- **Vector store:** tenant-scoped local PostgreSQL vector records by default, with optional Qdrant adapter.
- **LLM:** each Agent has its own encrypted OpenAI-compatible provider configuration; legacy workspace-level configuration and environment fallback remain only for backward compatibility.
- **Embeddings:** OpenAI-compatible neural embeddings when configured; otherwise the built-in deterministic lexical engine.

The production Worker runs with `APP_ENV=production` and Node.js compatibility.

## Knowledge upload

The normal browser flow is:

1. Cortex authenticates the workspace and validates the filename, size and extension.
2. Cortex creates a pending knowledge source and a short-lived R2 presigned PUT target.
3. The browser uploads directly to private R2.
4. Cortex HEAD-checks the stored object and only then starts extraction, chunking, embedding and indexing.
5. The source becomes `ready` only after vectors are stored successfully.

The default MVP file limit is **20 MB per file**. It is controlled by `site.maxUploadMb` and can be raised by an authorized administrator up to a hard cap of **200 MB per file**. URL ingestion is separately bounded to **25 MB**. A small multipart compatibility fallback is retained for development and for clients that cannot complete the direct upload path; in production it still stores the file in R2.

Current extraction support includes PDF, DOCX/DOCM, XLSX, PPTX and a broad set of text/data/code formats such as Markdown, CSV, JSON, XML, YAML, SQL, logs and common source-code extensions.

## Required production secrets

The Cloudflare Worker needs:

```text
DATABASE_URL
APP_SECRET_KEY
CORTEX_ADMIN_USERNAME
CORTEX_ADMIN_PASSWORD
R2_ACCOUNT_ID
R2_BUCKET_NAME
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
```

Optional runtime settings include:

```text
CORTEX_ADMIN_SESSION_SECRET
LLM_PROVIDER
LLM_BASE_URL
LLM_API_KEY
LLM_MODEL
LLM_AUTH_MODE
OPENROUTER_API_KEY
OPENROUTER_MODEL
OPENAI_API_KEY
EMBEDDINGS_MODEL
EMBEDDINGS_BASE_URL
QDRANT_URL
QDRANT_API_KEY
APP_PUBLIC_URL
TELEGRAM_INTERNAL_SECRET
CORS_ORIGINS
```

Keep application secrets in Cloudflare Worker Secrets or the protected GitHub Environment `cortex1`; never commit them to Git.

## AI provider

New workspaces should configure the real provider **inside each Agent → هوش مصنوعی**. The provider configuration is stored encrypted server-side and belongs to that Agent. Each Agent can use a different provider, Base URL and model. Legacy workspace-level configuration and environment fallback remain only for backward compatibility; an explicitly configured disabled Agent does not silently fall back. When the Agent has no usable provider, Cortex deliberately returns a `503` configuration error instead of generating a fake answer.

The lexical embedding engine is real deterministic retrieval, not a mock. For neural embeddings, configure `OPENAI_API_KEY` and the desired embeddings model.

## Telegram

Telegram bots can run through webhook or polling mode. Webhook mode needs a public `APP_PUBLIC_URL`. User access can be pending, allowed or blocked, with per-user message/token limits and usage visibility. `/newchat` starts a fresh conversation.

## API access

Each agent can issue and revoke API keys. The dedicated endpoint supports conversation continuity through `clientId` / `conversationId` / `newChat`. The OpenAI-compatible endpoint accepts the same identity controls and supports browser CORS when `CORS_ORIGINS` allows the caller.

See `docs/API_ACCESS.md` for the client contract.

## Security

- Tenant access is checked server-side for workspaces, agents, conversations, knowledge and Telegram resources.
- Knowledge URL ingestion blocks local/private destinations, re-checks redirects and bounds downloads.
- Provider credentials, Telegram tokens and webhook secrets are encrypted at rest with `APP_SECRET_KEY`.
- Production sessions require a persistent `APP_SECRET_KEY` of at least 32 characters.
- Production admin credentials are explicit; the development-only `admin` fallback is disabled in production.
- Chat POST requests are not automatically retried by the frontend/API client; only idempotent GET/HEAD/OPTIONS calls are retried.
- Usage limits use durable PostgreSQL reservations and transaction-scoped advisory locks so concurrent Worker isolates cannot bypass the same quota.

## CI and release

Two GitHub Actions workflows protect the MVP:

- **Cortex CI** validates Prisma, Vinext compatibility, TypeScript, ESLint and the Worker build on pushes and pull requests.
- **Cloudflare Deploy** targets the `cortex1` GitHub Environment. It verifies required production inputs **before deployment**, syncs Worker runtime secrets, prepares required PostgreSQL objects, deploys the Worker, verifies the runtime secret set and then runs authenticated smoke tests.

The deployment target is:

```text
https://cortex-ai.dengxiao445.workers.dev
```

A legacy Vercel status check may still appear on old GitHub commits; Vercel is not the production compute target.

## Local development

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma db push --accept-data-loss
npm run dev
```

For the Cloudflare runtime:

```bash
npm run dev:vinext
```

For first-time Cloudflare setup:

```bash
npm run setup:cloudflare
```

The setup script creates/validates the `cortex-ai-knowledge` R2 bucket, collects the required production credentials, stores them with Wrangler and deploys the Worker.

## Release definition for this MVP

The codebase is treated as release-ready when:

1. CI is green on the release commit.
2. The Cloudflare deployment job completes successfully, including runtime secret verification.
3. The post-deploy authenticated smoke tests pass.
4. At least one real LLM provider is configured for the workspace that will be used.
5. R2 browser upload + knowledge processing succeeds on the target Worker.
6. Telegram credentials/webhook configuration are present when Telegram is enabled.

