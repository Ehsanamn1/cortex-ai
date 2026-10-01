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
- **LLM:** customer-facing models are selected from the central Model Catalog. Provider credentials, Base URLs and routing are stored server-side in the private Admin Provider Registry; the customer never receives an API key or upstream Base URL. Trial can point to one admin-selected default model/provider and consume the workspace's 1,000 monthly trial credits.
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

New deployments can configure upstream AI providers centrally from **Admin → AI زیرساخت**. Define the Provider name, protocol, Base URL and API key once, then attach models to that Provider from the Model Catalog. Customer Agents select the Cortex model/route only; credentials stay encrypted server-side. One model can be marked as the Trial Default so newly created Trial workspaces use it automatically until their 1,000 credits are exhausted. Upstream credentials are resolved only through the private Admin Provider Registry.

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
- The production Control Center uses a dedicated owner-only UI login at `/admin/login`. The owner enters the fixed username `ehsanam86`; no password is requested. The browser receives a signed HttpOnly cookie used only to authorize backend admin requests.
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

A demo release is considered ready when the working application is deployed on Cloudflare, the target workspace has a real LLM provider configured, knowledge ingestion/retrieval works, and the core authenticated smoke journey passes.

Model fine-tuning is intentionally disabled in the current release and is presented as a **coming soon** capability. The current self-improvement layer is runtime memory/context management, not live weight updates.



## Private Admin Control Center

The production control center uses a private operator entry flow backed by a signed HttpOnly session. Public legacy admin entry points are disabled, while `/admin/login` is the supported username-only entry point and the resulting operator dashboard remains on an unguessable `/ops/<routeKey>/console` path.

Inside **AI زیرساخت**, the owner can create/rotate/disable system Providers, set Base URLs and API keys, inspect provider health, attach Model Catalog entries, and select the default Trial model. Plan/model access is controlled separately through the billing matrix.


**Trial routing:** `Trial Provider` is the upstream credential/endpoint, while `Trial Default Model` is the Model Catalog route. The default model should be attached to the intended Trial Provider; the Free workspace then uses that route and its normal billing reservation decrements the Trial credit balance.
