# Event Driven Architecture

## Customer Problem

Enterprise customers expect Build Signals to integrate with queues, webhooks, audit projections,
notifications, and downstream systems without fragile synchronous chains. Critical workflows need a
durable event trail that can be retried and replayed.

## Architecture Decision

This PR adds a durable outbox:

- `domain_event_outbox`
- `domain_event_subscriptions`

Core workflows emit best-effort domain events from service layers:

- Copilot completed or failed
- AI eval run completed
- Market ingestion completed
- Human review workflow transitioned

Admins can inspect event health at `/admin/events` and read or dispatch pending events through
`/api/admin/events`.

## Tradeoffs Considered

- Durable outbox before Kafka/SQS. This gives retry/replay semantics while keeping local and Vercel
  deployment simple.
- Best-effort emission so existing product flows do not fail if event persistence has a transient
  issue.
- Dispatcher currently marks events published without external fan-out. Future queue/webhook
  adapters can consume the same pending outbox rows.

## Scaling Path To 1 Million Opportunities

At scale, the outbox should be drained by background workers into managed queues. Event consumers
should build materialized read models for observability, alerts, public API webhooks, customer CRM
sync, and prompt/eval analytics. Partitioning by workspace, event type, and aggregate id keeps
queries fast while supporting replay by customer or workflow.
