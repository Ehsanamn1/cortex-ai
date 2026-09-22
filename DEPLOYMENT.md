# Cortex AI — Cloudflare Deployment

This project is configured for Cloudflare Workers with GitHub-based CI/CD.

Cloudflare deployment workflow: `.github/workflows/cloudflare-deploy.yml`.

Required GitHub environment: `cortex1`.
Required Cloudflare credentials: `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
Required runtime secrets: `DATABASE_URL`, `APP_SECRET_KEY`, `CORTEX_ADMIN_PASSWORD`.
