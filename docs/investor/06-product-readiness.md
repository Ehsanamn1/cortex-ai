# Cortex AI — Investor Product Readiness

## Current architecture

- Next.js App Router through Vinext
- Cloudflare Workers runtime
- PostgreSQL on Neon via Prisma
- private R2 knowledge storage
- tenant-scoped retrieval
- managed model catalog / routing
- billing ledger and credit enforcement
- Telegram channel
- authenticated API access

## Release definition

The product is investor-demo ready only after:
1. CI is green on the release commit.
2. Cloudflare deployment succeeds.
3. Post-deploy smoke tests pass.
4. A real LLM provider is configured for the demo workspace.
5. R2 knowledge upload and processing succeeds.
6. Telegram works when enabled.
7. Billing/payment path is verified.
8. Password reset is verified.
9. A demo workspace can complete the end-to-end path without manual database edits.

## End-to-end demo script

### 1. Sign up
Create account → create workspace → land on dashboard.

### 2. First Agent
Run onboarding:
Agent → managed model → Playground.

### 3. Company Brain
Upload a small company PDF → process → verify ready state.

### 4. Grounded answer
Ask a question answered from the uploaded source.

### 5. Deploy
Show the same Agent in API and/or Telegram.

### 6. Operations
Open analytics → show model/token usage → open wallet.

### 7. Commercial layer
Show plan gating and credit controls without exposing provider credentials.

### 8. Recovery
Use forgot-password flow from login.

## What investors should not be shown

- raw provider/API keys
- internal secrets
- fabricated dashboards
- fake customer data presented as real
- unverified market-size slides
