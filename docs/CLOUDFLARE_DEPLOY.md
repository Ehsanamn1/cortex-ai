# Cortex AI → Cloudflare Workers

Cortex AI is configured for Cloudflare Workers with vinext + the Cloudflare Vite plugin.

## Required Cloudflare setup

1. Authenticate Wrangler:

   `npx wrangler login`

2. Create the knowledge bucket once:

   `npx wrangler r2 bucket create cortex-ai-knowledge`

3. Put the production secrets into Workers. At minimum:

   `npx wrangler secret put DATABASE_URL`

   `npx wrangler secret put APP_SECRET_KEY`

   `npx wrangler secret put CORTEX_ADMIN_PASSWORD`

   `npx wrangler secret put CORTEX_ADMIN_SESSION_SECRET`

4. Generate Cloudflare types if needed:

   `npm run cf:typegen`

5. Test the Workers runtime locally:

   `npm run build:vinext`

   `npm run start:vinext`

6. One-command setup (recommended for a fresh machine):

   `npm run setup:cloudflare`

   This opens Cloudflare login, checks access, ensures the R2 bucket, asks for the runtime secrets, and deploys the Worker.

7. For GitHub auto-deploy, add repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The workflow at `.github/workflows/cloudflare-deploy.yml` then deploys every push to `main`.

7. Deploy manually when needed:

   `npm run deploy`

## Database

The application keeps using the existing Neon PostgreSQL database. Prisma is configured with the engine-less JS client and the Neon driver adapter so it can run in an edge/Workers runtime.

## Knowledge uploads

The upload API is limited to 20MB and stores uploaded knowledge files in the private R2 bucket. The file is then processed into chunks/embeddings and persisted in PostgreSQL + the configured vector store.

Do not expose the R2 bucket publicly. The Worker accesses it through the private binding.

## Important

The Cloudflare account itself must be connected/authenticated before the first deploy. This repository contains the deployment configuration, but account credentials and the R2 bucket belong to the Cloudflare account.
