# Cortex AI — R2 Knowledge Storage

Cortex AI supports direct browser-to-R2 knowledge uploads up to 200 MB per file.

Required Worker secrets:
- R2_ACCOUNT_ID
- R2_BUCKET_NAME
- R2_ACCESS_KEY_ID
- R2_SECRET_ACCESS_KEY

The GitHub deployment workflow syncs these values automatically from the `cortex1` Environment when they are present.

The upload flow is:
1. Cortex authenticates the user and creates a pending knowledge source.
2. The Worker issues a short-lived S3-compatible presigned PUT URL.
3. The browser uploads the file directly to R2, so the file does not pass through the Worker request-body limit.
4. Cortex verifies the stored object size, starts extraction/chunking/embedding, and indexes the resulting chunks.

Supported extraction currently includes PDF, DOCX, and a broad set of text/data/code formats. Unknown files are accepted by the upload picker but are only ingestible when their content can be safely interpreted as supported text/document content.

R2 CORS must allow the Cortex web origin to perform PUT requests to the bucket. Keep the CORS rule scoped to the production Worker/site origin rather than using a wildcard for credentials.

For very large binary documents, extraction is constrained by the Worker runtime memory available to the document parser; the 200 MB limit is a storage/upload limit, not a guarantee that every binary format can be parsed in one Worker invocation.
