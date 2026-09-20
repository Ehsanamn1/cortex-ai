# Cortex AI

AI knowledge assistant SaaS for private business knowledge.

## Production stack

- Next.js + React + TypeScript
- Prisma with PostgreSQL in production and SQLite for development
- Qdrant vector storage
- OpenAI-compatible LLM provider abstraction
- PDF, DOCX, TXT, Markdown and URL knowledge ingestion
- Grounded RAG with source citations
- Telegram bot integration
- Workspace admin, analytics, provider health and audit logs
- Docker deployment

## Deploy

See `docs/DEPLOYMENT.md` and `docs/ONLINE_DEPLOYMENT.md`.

Never commit `.env`, database files, API keys, or Telegram tokens.


