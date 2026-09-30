# Cortex AI — Investor Demo

## What to show

Use the live Cortex application and demonstrate one complete customer journey with a real workspace.

1. **Create an Agent**
   - Show the Agent identity, tone, instructions and model selection.
   - Emphasize that provider credentials remain server-side and the customer works with the Cortex model layer.

2. **Load business knowledge**
   - Add a real PDF/DOCX/TXT or URL containing the business information.
   - Wait for processing to reach the ready state.
   - Open Playground and ask a question whose answer is explicitly present in the uploaded material.

3. **Show grounded answers**
   - Point out the retrieved source references.
   - Ask a follow-up question that depends on the previous context.

4. **Show long-term memory**
   - In the conversation, provide a non-sensitive preference or stable business detail.
   - Open the Agent overview and show the memory panel.
   - Start another conversation and demonstrate that the remembered context can be used for continuity.
   - Do not claim that memory changes model weights; current self-improvement is runtime memory/context improvement, not live fine-tuning.

5. **Show Telegram**
   - Open Telegram operations.
   - Demonstrate the bot profile, managed access, users, limits and commands if configured.

6. **Show usage and billing**
   - Open billing/analytics and show real usage, credits and Toman-based cost reporting.
   - Do not invent revenue, user counts, retention, accuracy or other business metrics.

## Product message

> Cortex AI is a Persian-first business AI workspace for building agents around a company's own knowledge, persistent memory and real operating channels such as Telegram. The current product focuses on reliable knowledge retrieval, context continuity, controlled model routing, usage accounting and operational management. Model fine-tuning is intentionally kept as a future capability and is disabled in the current release.

## What to say about self-improvement

Cortex currently improves through its runtime architecture: it preserves relevant conversation context, stores explicit user preferences and durable business facts, ranks memories by importance/confidence/recency, keeps memory scoped to the correct workspace, and uses retrieved business knowledge as the factual source for grounded answers.

The next learning layer is planned as a separate capability: controlled dataset creation, evaluation and GPU fine-tuning. It is not enabled in the current release.

## Investor framing

The strongest demo is a real end-to-end flow:

**Business knowledge → Agent → Grounded answer → Persistent memory → Telegram deployment → Usage / billing**

The objective of the demo is to prove the product loop with working software, not to present unverified scale metrics.
