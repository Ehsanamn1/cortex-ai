# Cortex AI — Knowledge Pipeline

The Phase 1 knowledge pipeline is **fully real** — extraction, chunking, embeddings, and
vector storage all execute server-side. Statuses never lie: a source becomes `ready`
only after its vectors are actually stored.

```
                 ┌────────────── UPLOAD (multipart) ──────────────┐
                 │  validate extension (.pdf/.txt/.docx)          │
                 │  validate magic bytes (%PDF, PK zip, text)      │
                 │  enforce MAX_UPLOAD_MB                          │
                 │  persist bytes to .data/uploads/<sourceId>/     │
                 └───────────────────┬────────────────────────────┘
                                     │
                 ┌────────────── URL (json) ──────────────────────┐
                 │  scheme allowlist (http/https)                  │
                 │  block localhost/.local/.internal/metadata      │
                 │  DNS-resolve and reject private IPs (SSRF)      │
                 │  manual redirects (≤4) with re-validation       │
                 │  20s timeout · 5MB response cap                 │
                 └───────────────────┬────────────────────────────┘
                                     ▼
                        create KnowledgeSource + KnowledgeDocument
                              (status: pending → processing)
                                     ▼ async worker
   ┌──────────────────────────────────────────────────────────────────┐
   │ 1. EXTRACT                                                       │
   │    PDF  → unpdf, text per page (page numbers kept)               │
   │    DOCX → mammoth extractRawText                                 │
   │    TXT  → UTF-8 decode (NUL-byte binary rejection)               │
   │    URL  → content-type dispatch: html → cheerio readability      │
   │            (strip script/style/nav/…, heading-based sections),   │
   │            text/plain → raw, application/pdf → PDF path          │
   │ 2. NORMALIZE   Unicode control-char cleanup, whitespace collapse │
   │ 3. CHUNK       CHUNK_SIZE (default 1000 chars) with overlap      │
   │                (default 160); never crosses page/section         │
   │                boundaries → page & section stay accurate         │
   │ 4. EMBED       EmbeddingProvider.embedDocuments (batched 64)     │
   │ 5. STORE       KnowledgeChunk rows (text + metadata JSON)        │
   │                + VectorStore.upsertPoints (vector + payload)     │
   │ 6. READY       source + document flip to ready                   │
   └──────────────────────────────────────────────────────────────────┘
        failure at any step → status: failed + safe Persian message
        (technical diagnostics only in server logs)
```

## Chunk record

Each chunk persists: `id`, `documentId`, `sourceId`, `agentId`, `workspaceId`, `seq`,
`text`, `page` (PDF), `section` (HTML headings), `sourceUrl` (URL sources), and a
metadata JSON (`documentName`, `sourceType`, `sourceName`). Source identity is never
destroyed — this is what powers the playground's source chips («منبع: pricing.pdf —
صفحه ۴»).

## Vector record (local store)

`VectorPoint { id = chunkId, agentId, workspaceId, sourceId, documentId, vector (JSON
float[]), dims, payload (JSON: chunkId, text, documentName, page, section, sourceUrl,
seq) }`. Search loads the agent's points and computes exact cosine similarity. With
`QDRANT_URL` configured the same upsert/search/delete operations go to Qdrant with
`must` filters on `agentId`.

## Embedding providers

| Provider | Mode | Notes |
|---|---|---|
| `openai` | neural | Any OpenAI-compatible `/embeddings` endpoint (`OPENAI_API_KEY`, `EMBEDDINGS_MODEL`, optional `EMBEDDINGS_BASE_URL`). Real neural embeddings. |
| `local-lexical` | lexical | Always available. Real feature-hashing vector space: Persian-aware normalization (yeh/kaf/alef folding), tokens + bigrams + char-trigrams hashed into 2048 signed dims, sublinear TF, L2 normalization. True cosine retrieval — honestly labeled non-neural in Settings. |

Both implement `embedText` / `embedDocuments`. Business logic never knows which one is
active. If embeddings are somehow unconfigured, processing fails with a real error
(`failed` status) — vectors are never faked.

## Retrieval quality note (lexical mode)

The lexical engine matches shared vocabulary/morphology. A Persian question against a
Persian document (or English/English) retrieves correctly. For cross-language queries
(Persian question ↔ English document) the RAG layer performs **bilingual query
expansion**: when the first-pass top score is weak, the LLM rewrites the query in both
languages and each version re-retrieves; results merge by best chunk score. Neural
embeddings remove the need for this entirely.

## Updates & deletion

- **Retry** (`POST /api/knowledge/:id/retry`): purges old chunks + vectors, re-runs the
  full pipeline.
- **Delete source**: purges vectors → cascades documents/chunks → removes the stored
  upload file. No orphaned knowledge remains retrievable.
- **Delete agent**: purges all agent vectors, then cascades everything.
- Orphan checks (verified in testing): zero chunks/vectors without a live source.

## Honest status contract

| Status | Meaning |
|---|---|
| `pending` | Created, worker not started yet. |
| `processing` | Pipeline currently running (extract/chunk/embed/store). |
| `ready` | Vectors stored. **Never set before storage succeeds.** |
| `failed` | Real failure; Persian error surfaced; retry available. |
