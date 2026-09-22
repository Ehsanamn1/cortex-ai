# Local setup

## Requirements

- Node.js 20.18+ (22 recommended)
- npm
- A real OpenAI-compatible LLM API key for live answers
- Optional Qdrant instance for vector storage

## Start

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma db push --accept-data-loss
npm run dev
```

Windows PowerShell:

```powershell
npm install
Copy-Item .env.example .env
npx prisma generate
npx prisma db push --accept-data-loss
npm run dev
```

Then open http://localhost:3000.

## Docker

```bash
docker compose up --build
```

The container uses PostgreSQL from `DATABASE_URL`. Qdrant is started locally by Compose as the optional vector backend. Set the required runtime secrets in `.env`; do not commit that file.

## Provider

The preferred configuration is in the app: Settings → اتصال AI. Set provider name, base URL, model, auth mode and API key.

## Cloudflare validation

```bash
npm run typecheck
npm run check:vinext
npm run lint
npm run build:vinext
```

The production target is Cloudflare Workers. The repository also keeps a Node/Docker build as an alternate self-hosting path.
