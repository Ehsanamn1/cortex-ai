# Cortex AI → Cloudflare Workers

Cortex uses Vinext + the Cloudflare Vite plugin on Workers and Neon PostgreSQL through Prisma. R2 is optional; when R2 is unavailable, uploaded knowledge files use a temporary database-backed processing fallback.

## 1. Optional R2

R2 can be enabled later for large-file object storage. The application can deploy without R2; knowledge uploads fall back to temporary database storage during processing.

## 2. Set Worker secrets

```bash
npx wrangler secret put DATABASE_URL
npx wrangler secret put APP_SECRET_KEY
npx wrangler secret put CORTEX_ADMIN_PASSWORD
```

Optional:

```bash
npx wrangler secret put CORTEX_ADMIN_USERNAME
npx wrangler secret put CORTEX_ADMIN_SESSION_SECRET
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put TELEGRAM_INTERNAL_SECRET
```

Keep API keys and database URLs out of GitHub source.

## 3. Validate locally

```bash
npm run check:vinext
npm run build:vinext
npm run start:vinext
```

## 4. GitHub auto-deploy

`.github/workflows/cloudflare-deploy.yml` runs on pushes to `main`.

GitHub Environment `cortex1` supplies:

```
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

The workflow does not copy application secrets through GitHub. Wrangler checks the Worker-side required secrets at deployment.

## 5. Fresh-machine setup

```bash
npm run setup:cloudflare
```

This authenticates Wrangler, verifies Cloudflare access, handles R2 setup, prompts for Worker secrets and deploys locally.

## Production database

The existing Neon PostgreSQL database remains the production database and is used through `@prisma/adapter-neon`.

## Telegram

Webhook mode requires a public `APP_PUBLIC_URL`. Polling mode uses the internal polling route and should be invoked by a trusted scheduler.

Cloudflare Workers currently support the Node `crypto` APIs Cortex uses, including `scryptSync`; Workers also expose Web Crypto. citeturn176292search0turn176292search9
