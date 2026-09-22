# Cortex AI — API reference

Base URL: same origin at `/api`. Normal SaaS sessions use `cortex_session`; the admin control center uses `cortex_admin_session`.

## Health

`GET /api/health` — public dependency health: PostgreSQL, R2 binding, LLM/embedding status and required environment presence.

`GET /api` — lightweight service status.

`GET /api/site-config` — public editable product settings.

## Auth

`POST /api/auth/signup` — `{ name?, email, password }`; creates the user and default workspace atomically.

`POST /api/auth/login` — `{ email, password }`; rate-limited.

`POST /api/auth/logout` — clears the session.

`GET /api/auth/me` — current user and workspace memberships.

## Workspaces

`GET /api/workspaces` — current memberships.

`POST /api/workspaces` — creates a workspace.

## Agents

`GET /api/agents` — lists agents for the user's accessible workspace.

`POST /api/agents` supports:
- `name`, `orgName`, `description`
- `language`, `tone`, `customTone`, `instructions`
- `persona`, `systemPrompt`
- `temperature`, `topP`, `maxTokens`
- `memoryEnabled`, `citationsEnabled`, `workspaceId`

`GET /api/agents/:id` — agent details and knowledge readiness.

`PATCH /api/agents/:id` — updates allowed Agent fields.

`DELETE /api/agents/:id` — removes the Agent, conversations, knowledge and vectors.

## Knowledge

`GET /api/agents/:id/knowledge`

`POST /api/agents/:id/knowledge` — multipart file upload or JSON URL ingestion; validates size/type and protects against SSRF.

`DELETE /api/knowledge/:id` — deletes stored object/chunks/vectors and the source.

`POST /api/knowledge/:id/retry` — retries processing.

## Conversations / RAG

`GET /api/agents/:id/conversations`

`POST /api/agents/:id/conversations` — New Chat.

`GET /api/conversations/:id`

`DELETE /api/conversations/:id`

`POST /api/conversations/:id/chat` — tenant-scoped retrieval + grounded real-provider generation. Provider-not-configured returns 503; provider transport errors return 502.

## Providers

`GET /api/providers/status`

`POST /api/providers/health`

`GET /api/settings/provider`

`PUT /api/settings/provider` — owner/admin; encrypts API key at rest.

`GET /api/settings/limits`

`PUT /api/settings/limits` — owner/admin.

## Telegram

`GET/POST /api/telegram/bots`

`GET/PATCH/DELETE /api/telegram/bots/:id` — Agent reassignment is restricted to the same workspace.

`GET/POST/DELETE /api/telegram/bots/:id/allowlist`

`POST /api/telegram/webhook/:botId` — requires the configured Telegram secret token.

`POST /api/telegram/internal/poll` — protected by `TELEGRAM_INTERNAL_SECRET`.

## Admin / control center

`POST /api/admin/auth/login`

`GET /api/admin/auth/me`

`POST /api/admin/auth/logout`

`GET /api/control-center`

`GET/PUT /api/control-center/settings`

`GET/POST/PATCH/DELETE /api/control-center/plugins`

`GET /api/admin/overview`

`GET/PATCH /api/admin/telegram-users`

`GET /api/admin/analytics`

All workspace-scoped operations enforce server-side membership/role checks. Secrets are never returned through provider configuration endpoints.
