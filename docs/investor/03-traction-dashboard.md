# Cortex AI — Traction Dashboard Specification

## Purpose

This dashboard is the single source of truth for investor-facing traction. It must be generated from production data and never manually inflated.

## Executive KPIs

| KPI | Definition | Source |
|---|---|---|
| Registered Workspaces | Workspaces created in period | production DB |
| Activated Workspaces | Workspaces reaching first successful agent run | event/DB |
| Activation Rate | Activated / new workspaces | derived |
| WAU | Workspaces with >=1 meaningful action in 7d | usage/events |
| MAU | Workspaces with >=1 meaningful action in 30d | usage/events |
| Paid Workspaces | Workspaces on paid plan | billing |
| MRR | Active monthly recurring subscription revenue | billing |
| Top-up Revenue | Completed top-up payments | billing |
| Requests | Successful LLM requests | usage ledger |
| Provider COGS | Estimated provider spend | usage ledger/model catalog |
| Gross Margin | (Revenue - COGS) / Revenue | derived |
| Retention | Cohort return rate | events |
| Churn | Paid workspaces that cancel/downgrade | billing |

## Activation event

A workspace is **activated** when it has:
1. an active workspace,
2. at least one Agent,
3. at least one successful grounded or non-grounded Agent run.

## Meaningful usage event

Count:
- successful Agent run
- knowledge source becoming ready
- Telegram conversation message
- authenticated API completion

Do not count page views as product usage.

## Cohort retention

For each signup month:
- Week 1 retained = workspace with meaningful usage in days 7–13
- Week 4 retained = usage in days 28–34
- Month 2 retained = usage in days 45–74

Use workspace-level cohorts, not raw request volume.

## Revenue

Revenue should be separated into:
- recurring subscription revenue
- top-up revenue
- enterprise/contract revenue

Do not include failed/pending payments.

## Investor export

Create a monthly snapshot with:
- month
- new workspaces
- activated workspaces
- paid workspaces
- MRR
- top-up revenue
- successful requests
- provider COGS
- gross margin
- churned workspaces
- retained workspaces

## Current evidence status

At the time this document is created, no verified production traction numbers are inserted into the investor pack. Populate this sheet from actual production data before sharing externally.

## Minimum evidence threshold before active investor outreach

Use actual data to demonstrate:
- at least one complete acquisition → activation → usage → payment funnel
- at least one retention cohort
- actual provider COGS
- at least one paid customer reference/testimonial where permission exists

These are internal preparation thresholds, not universal industry requirements.
