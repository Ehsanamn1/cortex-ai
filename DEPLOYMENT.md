# Cortex AI — Cloudflare deployment

Production compute is Cloudflare Workers. The repository deploys through:

`.github/workflows/cloudflare-deploy.yml`

## GitHub Actions

The deploy job references the protected GitHub Environment `cortex1`.

That environment supplies only the Cloudflare CI credentials:

```
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

Application/database credentials should not be committed to Git or copied into source files.

## Worker runtime secrets

The Cloudflare Worker requires:

```
DATABASE_URL
APP_SECRET_KEY
CORTEX_ADMIN_PASSWORD
```

Optional runtime settings include:

```
CORTEX_ADMIN_USERNAME
CORTEX_ADMIN_SESSION_SECRET
OPENAI_API_KEY
EMBEDDINGS_MODEL
EMBEDDINGS_BASE_URL
QDRANT_URL
QDRANT_API_KEY
APP_PUBLIC_URL
TELEGRAM_INTERNAL_SECRET
```

These values belong to the Worker environment and are managed in Cloudflare.

## R2

Knowledge uploads use the private R2 bucket `cortex-ai-knowledge` via the binding `CORTEX_KNOWLEDGE_BUCKET`.

The deployment workflow verifies the bucket before publishing the Worker.

## Deployment flow

1. Install dependencies.
2. Build with Vinext.
3. Validate GitHub → Cloudflare credentials.
4. Verify/create the R2 bucket.
5. Deploy with `@vinext/cloudflare deploy`.
6. Wrangler validates the Worker-side required secrets.

## Local validation

```bash
npm install
npm run check:vinext
npm run build:vinext
npm run start:vinext
```

For fresh Cloudflare setup:

```bash
npm run setup:cloudflare
```

A protected GitHub Environment can require approval before a job is released and its secrets become available. That approval is an external GitHub account setting.
