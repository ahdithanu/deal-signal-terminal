import { randomUUID } from "node:crypto";

import { getDatabase, resolveDatabaseProvider } from "@/lib/db";
import { queryPostgres } from "@/lib/postgres";

type AuditEventInput = {
  orgId?: string | null;
  userId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
};

export type AuditEventRecord = {
  id: string;
  occurred_at: string;
  org_id: string | null;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata_json: string;
};

export async function recordAuditEvent(event: AuditEventInput) {
  const id = randomUUID();
  const occurredAt = new Date().toISOString();
  const metadataJson = JSON.stringify(event.metadata ?? {});

  if (resolveDatabaseProvider() === "postgres") {
    await queryPostgres(
      `INSERT INTO audit_events (
        id,
        occurred_at,
        org_id,
        user_id,
        action,
        resource_type,
        resource_id,
        metadata_json
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        occurredAt,
        event.orgId ?? null,
        event.userId ?? null,
        event.action,
        event.resourceType,
        event.resourceId ?? null,
        metadataJson,
      ]
    );
    return;
  }

  const db = getDatabase();

  db.prepare(
    `INSERT INTO audit_events (
      id,
      occurred_at,
      org_id,
      user_id,
      action,
      resource_type,
      resource_id,
      metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    occurredAt,
    event.orgId ?? null,
    event.userId ?? null,
    event.action,
    event.resourceType,
    event.resourceId ?? null,
    metadataJson
  );
}

type ListRecentAuditEventsOptions = {
  limit?: number;
  orgId?: string;
};

export async function listRecentAuditEvents(options: ListRecentAuditEventsOptions = {}) {
  const limit = options.limit ?? 50;

  if (resolveDatabaseProvider() === "postgres") {
    if (options.orgId) {
      const result = await queryPostgres<AuditEventRecord>(
        `SELECT
          id,
          occurred_at,
          org_id,
          user_id,
          action,
          resource_type,
          resource_id,
          metadata_json
        FROM audit_events
        WHERE org_id = $1
        ORDER BY occurred_at DESC
        LIMIT $2`,
        [options.orgId, limit]
      );

      return result.rows;
    }

    const result = await queryPostgres<AuditEventRecord>(
      `SELECT
        id,
        occurred_at,
        org_id,
        user_id,
        action,
        resource_type,
        resource_id,
        metadata_json
      FROM audit_events
      ORDER BY occurred_at DESC
      LIMIT $1`,
      [limit]
    );

    return result.rows;
  }

  const db = getDatabase();

  if (options.orgId) {
    return db
      .prepare(
        `SELECT
          id,
          occurred_at,
          org_id,
          user_id,
          action,
          resource_type,
          resource_id,
          metadata_json
        FROM audit_events
        WHERE org_id = ?
        ORDER BY occurred_at DESC
        LIMIT ?`
      )
      .all(options.orgId, limit) as AuditEventRecord[];
  }

  return db
    .prepare(
      `SELECT
        id,
        occurred_at,
        org_id,
        user_id,
        action,
        resource_type,
        resource_id,
        metadata_json
      FROM audit_events
      ORDER BY occurred_at DESC
      LIMIT ?`
    )
    .all(limit) as AuditEventRecord[];
}
