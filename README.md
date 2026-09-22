# Cortex AI

Cortex AI is an AI knowledge-agent platform: build an agent from your own business knowledge, connect a real LLM provider, test it in a persistent playground, and expose the same agent through Telegram.

## Product

- Phase 1 — Auth, workspaces, agents, PDF/TXT/DOCX/URL knowledge ingestion, chunking, embeddings, vector search, grounded RAG, source-aware answers, conversations and New Chat.
- Phase 2 — Telegram bots, contact verification, allowlist/blocking, webhook or polling, per-user sessions, usage tracking and limits.
- Phase 3 — Admin control center, analytics, audit log, provider settings, knowledge operations, health checks and production hardening.

## Local preview

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma db push --accept-data-loss
npm run dev
```

Open `http://localhost:3000`. The UI is Persian RTL-first and the app is designed around an original Cortex visual system: obsidian surfaces, electric blue/violet accents, depth, 3D motion and restrained glass effects.

## AI provider

Cortex supports workspace-level OpenAI-compatible gateways. Configure these in **Settings → اتصال AI** so the app does not depend on one provider. Supported auth modes: Bearer, X-API-Key and none.

Environment fallbacks are optional:

```env
LLM_BASE_URL=
LLM_API_KEY=
LLM_MODEL=
LLM_AUTH_MODE=bearer
```

## Telegram

Create a bot from the Telegram page. Webhook mode requires a public `APP_PUBLIC_URL`; polling mode can run with:

```bash
npm run telegram:poll
```

The bot asks for the user’s own Telegram contact, checks the allowlist, and maintains a separate session per Telegram user. `/newchat` creates a new session.

## Production

The application is configured for PostgreSQL in production. Set a PostgreSQL connection string in `DATABASE_URL` (for example from Neon) and keep `APP_SECRET_KEY` as a long random secret. Do not commit `.env`, API keys, Telegram tokens, or database credentials.

The repository includes a production Dockerfile, Docker Compose with Qdrant, and GitHub Actions CI. Railway can run the same container.

## Verification

GitHub Actions validates Prisma schema, TypeScript, ESLint and the production Next.js build on every push to `main`.

## Security

Provider keys, Telegram tokens and webhook secrets are encrypted at rest using `APP_SECRET_KEY`. Never commit `.env`, database files or real API keys.
