import { randomUUID } from "node:crypto";

import { getDatabase, resolveDatabaseProvider } from "@/lib/db";
import { logError } from "@/lib/observability";
import { queryPostgres } from "@/lib/postgres";
import type {
  DomainEvent,
  DomainEventSubscription,
  EventDashboard,
  EventDispatchResult,
  PublishDomainEventInput,
} from "@/types/domain-events";

type EventRow = {
  id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  org_id: string | null;
  user_id: string | null;
  payload_json: string;
  status: "pending" | "published" | "failed";
  attempts: number;
  available_at: string;
  published_at: string | null;
  error_message: string | null;
  created_at: string;
};

type SubscriptionRow = {
  id: string;
  name: string;
  event_type: string;
  target_type: "internal" | "webhook" | "queue";
  target_ref: string;
  status: "active" | "paused";
  created_at: string;
  updated_at: string;
};

function nowIso() {
  return new Date().toISOString();
}

function parsePayload(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function eventFromRow(row: EventRow): DomainEvent {
  return {
    id: row.id,
    eventType: row.event_type,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    orgId: row.org_id,
    userId: row.user_id,
    payload: parsePayload(row.payload_json),
    status: row.status,
    attempts: Number(row.attempts),
    availableAt: row.available_at,
    publishedAt: row.published_at,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  };
}

function subscriptionFromRow(row: SubscriptionRow): DomainEventSubscription {
  return {
    id: row.id,
    name: row.name,
    eventType: row.event_type,
    targetType: row.target_type,
    targetRef: row.target_ref,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function publishDomainEvent(input: PublishDomainEventInput): Promise<DomainEvent> {
  const createdAt = nowIso();
  const event: DomainEvent = {
    id: randomUUID(),
    eventType: input.eventType,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    orgId: input.orgId ?? null,
    userId: input.userId ?? null,
    payload: input.payload,
    status: "pending",
    attempts: 0,
    availableAt: input.availableAt ?? createdAt,
    publishedAt: null,
    errorMessage: null,
    createdAt,
  };
  const values = [
    event.id,
    event.eventType,
    event.aggregateType,
    event.aggregateId,
    event.orgId,
    event.userId,
    JSON.stringify(event.payload),
    event.status,
    event.attempts,
    event.availableAt,
    event.publishedAt,
    event.errorMessage,
    event.createdAt,
  ];

  if (resolveDatabaseProvider() === "postgres") {
    await queryPostgres(
      `INSERT INTO domain_event_outbox (
        id, event_type, aggregate_type, aggregate_id, org_id, user_id, payload_json,
        status, attempts, available_at, published_at, error_message, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      values
    );
  } else {
    getDatabase()
      .prepare(
        `INSERT INTO domain_event_outbox (
          id, event_type, aggregate_type, aggregate_id, org_id, user_id, payload_json,
          status, attempts, available_at, published_at, error_message, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(...values);
  }

  return event;
}

export async function emitDomainEvent(input: PublishDomainEventInput) {
  try {
    return await publishDomainEvent(input);
  } catch (error) {
    logError("Domain event publish failed", error, {
      eventType: input.eventType,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
    });
    return null;
  }
}

export async function listDomainEvents(limit = 50): Promise<DomainEvent[]> {
  const rows =
    resolveDatabaseProvider() === "postgres"
      ? (
          await queryPostgres<EventRow>(
            "SELECT * FROM domain_event_outbox ORDER BY created_at DESC LIMIT $1",
            [limit]
          )
        ).rows
      : (getDatabase()
          .prepare("SELECT * FROM domain_event_outbox ORDER BY created_at DESC LIMIT ?")
          .all(limit) as EventRow[]);

  return rows.map(eventFromRow);
}

export async function listDomainEventSubscriptions(): Promise<DomainEventSubscription[]> {
  const rows =
    resolveDatabaseProvider() === "postgres"
      ? (await queryPostgres<SubscriptionRow>("SELECT * FROM domain_event_subscriptions ORDER BY name"))
          .rows
      : (getDatabase()
          .prepare("SELECT * FROM domain_event_subscriptions ORDER BY name")
          .all() as SubscriptionRow[]);

  return rows.map(subscriptionFromRow);
}

async function markEvent(id: string, status: "published" | "failed", errorMessage?: string | null) {
  const publishedAt = status === "published" ? nowIso() : null;

  if (resolveDatabaseProvider() === "postgres") {
    await queryPostgres(
      `UPDATE domain_event_outbox
       SET status = $1, attempts = attempts + 1, published_at = $2, error_message = $3
       WHERE id = $4`,
      [status, publishedAt, errorMessage ?? null, id]
    );
  } else {
    getDatabase()
      .prepare(
        `UPDATE domain_event_outbox
         SET status = ?, attempts = attempts + 1, published_at = ?, error_message = ?
         WHERE id = ?`
      )
      .run(status, publishedAt, errorMessage ?? null, id);
  }
}

export async function dispatchPendingDomainEvents(limit = 25): Promise<EventDispatchResult> {
  const now = nowIso();
  const rows =
    resolveDatabaseProvider() === "postgres"
      ? (
          await queryPostgres<EventRow>(
            `SELECT * FROM domain_event_outbox
             WHERE status = 'pending' AND available_at <= $1
             ORDER BY created_at ASC
             LIMIT $2`,
            [now, limit]
          )
        ).rows
      : (getDatabase()
          .prepare(
            `SELECT * FROM domain_event_outbox
             WHERE status = 'pending' AND available_at <= ?
             ORDER BY created_at ASC
             LIMIT ?`
          )
          .all(now, limit) as EventRow[]);

  let published = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      await markEvent(row.id, "published");
      published += 1;
    } catch (error) {
      failed += 1;
      await markEvent(row.id, "failed", error instanceof Error ? error.message : "Dispatch failed");
    }
  }

  return { scanned: rows.length, published, failed };
}

export async function getEventDashboard(): Promise<EventDashboard> {
  const events = await listDomainEvents(50);
  const subscriptions = await listDomainEventSubscriptions();

  return {
    pending: events.filter((event) => event.status === "pending").length,
    published: events.filter((event) => event.status === "published").length,
    failed: events.filter((event) => event.status === "failed").length,
    recentEvents: events,
    subscriptions,
  };
}
