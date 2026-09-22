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

This starts Cortex and Qdrant. SQLite is persisted in `./db` for single-instance local use.

## Provider

The preferred configuration is in the app: Settings → اتصال AI. Set provider name, base URL, model, auth mode and API key.

## Validation

```bash
npm run typecheck
npm run lint
npm run build
```
