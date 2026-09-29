# Cortex AI — Investor Brief

**Status:** Pre-seed preparation  
**Product:** Multi-tenant AI knowledge-agent SaaS  
**Primary market hypothesis:** Persian-speaking SMB and mid-market teams that need controlled AI agents over proprietary knowledge and operational channels.

## One-line company description

Cortex turns a company's knowledge into deployable AI agents that can be configured, tested, monitored, and exposed through channels such as web APIs and Telegram.

## Problem

Teams that want useful AI over company knowledge typically have to stitch together model access, document ingestion, retrieval, prompts, memory, permissions, usage controls, analytics, and channel integrations. The resulting stack is costly to operate and difficult for non-technical teams to manage.

## Product

Cortex brings those workflows into one managed workspace:

- Company Brain: document/URL ingestion, chunking, embeddings, tenant-scoped retrieval and grounded answers.
- Agent Studio: persona, language, tone, instructions, model settings, memory and citation controls.
- Business Operations: usage limits, analytics, audit logs, model health, billing and API access.
- Channels: persistent playground, authenticated APIs and Telegram.
- Managed commercial routing: model/provider infrastructure stays behind Cortex; plans control which managed models are available.
- Cost controls: credit-based billing, request reservations and overage enforcement are designed to keep provider spend bounded.

## Why now

AI has moved from experimentation to workflow integration. At the U.S. pre-seed level, Carta reported that AI captured about 49% of pre-seed dollars in H1 2026, while capital became more concentrated across fewer deals. This makes product evidence, clear economics and disciplined milestones especially important.

Source: https://carta.com/data/state-of-pre-seed-q2-2026/  
Source: https://carta.com/data/pre-seed-funding-map-q2-2026/

## Business model

Cortex uses a recurring subscription model with included monthly credits, plus optional credit top-ups. Higher plans unlock more agents, knowledge capacity, model quality and operational features.

Current product catalog (Toman/month):
- Launch: 3,900,000
- Growth: 12,900,000
- Scale: 24,900,000
- Enterprise: contract pricing

These are product catalog values, not validated market demand.

## Current product evidence

The repository currently contains working implementations for:
- authentication and password recovery
- multi-tenant workspaces
- agents and persistent playground
- knowledge pipeline and tenant-scoped retrieval
- Telegram access controls
- API keys and OpenAI-compatible chat API
- usage analytics and billing ledger
- managed model catalog and plan gating
- Cloudflare Workers + PostgreSQL/Neon + R2 production architecture
- CI and release validation

**Important:** user/revenue/retention traction is not represented here as a verified number. The traction dashboard must be populated from real production data before being presented to investors.

## Moat hypothesis

The intended differentiation is not a single model. The defensibility hypothesis is the operational layer around company-specific AI: tenant isolation, knowledge grounding, agent configuration, channel deployment, billing/usage controls, analytics and workflow data. This must be proven by customer usage and retention rather than asserted as a finished moat.

## Fundraising planning case

**Illustrative planning target:** USD 500,000 pre-seed.

This is a planning case, not a market valuation or guaranteed financing outcome. The model assumes the round is used to buy approximately 18 months of runway and reach measurable product-market validation milestones.

The current U.S. pre-seed market provides a broad reference range: Carta's September 2026 guide says most pre-seed rounds land between $150k and $1M, while its Q2 2026 data puts the average pre-seed instrument at $276k.

Sources:
- https://carta.com/learn/startups/fundraising/pre-seed-funding/
- https://carta.com/data/state-of-pre-seed-q2-2026/

## What the round should prove

By the end of the planned runway, the company should be able to demonstrate:
1. repeatable activation from signup to first useful agent
2. retained weekly/monthly usage
3. a growing base of paying workspaces
4. predictable provider cost per active workspace
5. gross margin that improves with routing, pricing and product mix
6. repeatable customer acquisition channels
7. a clear vertical/ICP where Cortex wins repeatedly

## Investor-readiness rule

Do not substitute screenshots for evidence. The strongest package is:

**live product + customer proof + usage data + unit economics + disciplined use of funds.**
