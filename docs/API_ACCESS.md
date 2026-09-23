# Cortex AI — Agent API

Cortex exposes two authenticated agent endpoints. API keys are created per agent and stored server-side as SHA-256 hashes; the complete key is shown only once.

## Authentication

Send:

```http
Authorization: Bearer ck_live_...
```

or:

```http
x-api-key: ck_live_...
```

The browser-facing API key management screen shows the exact base URL and endpoint for the current deployment.

## Dedicated agent endpoint

`POST /api/v1/agents/{agentId}/chat`

Request:

```json
{
  "message": "سلام",
  "clientId": "customer-123",
  "conversationId": "optional-existing-conversation-id",
  "newChat": false
}
```

Rules:

- `clientId` identifies the external caller.
- Without `newChat`, Cortex reuses the latest API conversation for the same agent + client.
- With `conversationId`, Cortex continues that exact conversation only when it belongs to the same agent + client.
- With `newChat: true`, Cortex always creates a new conversation.
- The returned `conversationId` can be persisted by the caller when explicit session control is preferred.

## OpenAI-compatible endpoint

`POST /api/v1/chat/completions`

Request:

```json
{
  "messages": [
    { "role": "user", "content": "سلام" }
  ],
  "clientId": "customer-123",
  "conversationId": "optional-existing-conversation-id",
  "newChat": false
}
```

The caller can also send `X-Cortex-Client-Id` and `X-Cortex-Conversation-Id` headers. JSON body values are used when the corresponding header is absent.

## Grounded knowledge

The same RAG pipeline is used by the web playground, dedicated API, OpenAI-compatible API and Telegram. Only knowledge sources in `ready` state are eligible for retrieval. The prompt treats retrieved knowledge as the factual source and bounded conversation history as contextual memory; when the knowledge base is insufficient, the agent is instructed not to fabricate an answer.

## CORS

External browser clients must use an allowed origin configured through `CORS_ORIGINS`. Preflight `OPTIONS` is supported on both external chat endpoints.

## Usage limits

Workspace quotas and Telegram per-user quotas are checked before model generation. Generation requests reserve the bounded request budget and release it after the request succeeds or fails, which prevents simple concurrent-request races from bypassing limits.

## Errors

The API returns a JSON body in the form:

```json
{ "error": "پیام خطا" }
```

Authentication failures use HTTP 401, invalid requests use 400, quota failures use 429, unavailable AI/RAG configuration uses 503, and upstream provider failures use an appropriate 502/5xx response.

## External requirements

A real AI answer requires an enabled workspace provider or environment provider. R2-backed file ingestion in production requires the four R2 Worker secrets documented in `docs/R2_KNOWLEDGE_STORAGE.md`.
