# Cortex AI — current architecture

## Runtime

```
Browser (Persian RTL SaaS)
        │
        ▼
Vinext / Next.js App Router
        │
        ├── API routes
        │     ├── auth / workspace / agents
        │     ├── knowledge / RAG / conversations
        │     ├── Telegram
        │     └── admin / analytics / control center
        │
        ├── provider abstractions
        └── business modules
        │
   ┌────┴──────────────┐
   ▼                   ▼
Neon PostgreSQL      Cloudflare R2
```

## Persistence

Prisma uses PostgreSQL with the Neon adapter. The schema includes tenants/workspaces, users, agents, knowledge sources/documents/chunks, conversations/messages, vector points, provider configuration, Telegram, usage/audit data, admin control data and plugin metadata.

## Knowledge

```
file / URL
  → validation
  → R2 persistence
  → extraction
  → normalization + chunking
  → embeddings
  → chunks + vectors
  → ready
```

A knowledge source becomes `ready` only after its chunks and vector records are successfully stored.

## Retrieval and RAG

```
question
  → agent-scoped vector search
  → database re-verification
  → optional query expansion
  → bounded grounded prompt
  → configured LLM
  → persisted answer + source metadata
```

No fabricated source citations or fake answers are generated when provider/knowledge requirements are missing.

## Providers

LLM: workspace-level OpenAI-compatible provider with optional environment fallback such as OpenRouter.

Embeddings: OpenAI-compatible neural embeddings when configured; otherwise deterministic local lexical embeddings.

Vectors: PostgreSQL-backed exact cosine similarity by default, optional Qdrant.

## Control plane

Authentication, workspace roles, advanced Agent configuration, persistent conversations, knowledge processing, Telegram allowlists/limits, analytics, audit logs, provider health checks, product settings and plugin metadata are implemented.

## Cloudflare runtime

The Worker uses the current compatibility date and Node compatibility required by the application. Cloudflare documents full `node:crypto` support for Workers, including the APIs used by Cortex. citeturn176292search0turn176292search1
