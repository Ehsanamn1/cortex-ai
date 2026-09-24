# Cortex AI — Cloudflare deployment

Production compute is Cloudflare Workers.

The canonical deployment workflow is:

`.github/workflows/cloudflare-deploy.yml`

## GitHub Environment

The workflow uses the protected GitHub Environment `cortex1`.

The environment must provide:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
DATABASE_URL
CORTEX_ADMIN_USERNAME
CORTEX_ADMIN_PASSWORD
R2_ACCOUNT_ID
R2_BUCKET_NAME
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
```

`APP_SECRET_KEY` is strongly recommended in the protected Environment. When it is not supplied there, the workflow preserves an existing Worker secret and generates one only when the Worker does not already have a persistent value.

Optional values may include:

```text
POSTGRES_PRISMA_URL
POSTGRES_URL
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

Never commit these values to the repository.

## R2

Knowledge uploads use the private R2 bucket `cortex-ai-knowledge` through S3-compatible presigned URLs. There is **no** `CORTEX_KNOWLEDGE_BUCKET` Worker binding in the current architecture.

Required R2 credentials are:

```text
R2_ACCOUNT_ID
R2_BUCKET_NAME
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
```

The browser normally uploads directly to R2, avoiding the Worker request-body limit. The MVP default is 20 MB per file; `site.maxUploadMb` can raise it up to the 200 MB hard cap.

The local/development multipart fallback may store a small `db64://` payload in PostgreSQL when R2 is unavailable. Production rejects that fallback path when R2 is not configured.

## Release order

The deployment workflow intentionally follows this order:

1. Install dependencies.
2. Generate Prisma and build the Worker.
3. Verify Cloudflare credentials.
4. Verify required production inputs before any deployment.
5. Sync runtime secrets to the target Worker.
6. Ensure `pgcrypto`, `AgentApiKey` and `UsageReservation` database objects exist.
7. Verify the Worker runtime secret set.
8. Deploy the Worker.
9. Run authenticated app/API smoke tests.
10. Run the public `/api/health` smoke test.

This prevents the previous failure mode where new code was deployed first and the job only discovered missing production credentials afterward.

## Local validation

```bash
npm install
npm run check:vinext
npm run typecheck
npm run lint
npm run build:vinext
```

For first-time Cloudflare setup:

```bash
npm run setup:cloudflare
```

The setup helper creates the `cortex-ai-knowledge` bucket if necessary and prompts for all runtime secrets required by the production Worker.

## Smoke coverage

The deploy workflow exercises:

- public `/control-center` and `/admin` pages;
- unauthenticated admin protection;
- signup and persistent session;
- workspace/agent/dashboard/provider/Telegram/admin/analytics routes;
- agent API-key creation and revocation;
- authenticated dedicated Agent API;
- authenticated OpenAI-compatible chat endpoint;
- production Worker health endpoint.

When no real LLM provider is configured, authenticated chat endpoints are allowed to return the intentional `503` "not configured" response; route/authentication correctness is still validated.

## Current target

```text
https://cortex-ai.dengxiao445.workers.dev
```

