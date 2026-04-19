import { randomUUID } from "node:crypto";

import { getDatabase } from "@/lib/db";

type AuditEventInput = {
  orgId?: string | null;
  userId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
};

export function recordAuditEvent(event: AuditEventInput) {
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
    randomUUID(),
    new Date().toISOString(),
    event.orgId ?? null,
    event.userId ?? null,
    event.action,
    event.resourceType,
    event.resourceId ?? null,
    JSON.stringify(event.metadata ?? {})
  );
}

type ListRecentAuditEventsOptions = {
  limit?: number;
  orgId?: string;
};

export function listRecentAuditEvents(options: ListRecentAuditEventsOptions = {}) {
  const db = getDatabase();
  const limit = options.limit ?? 50;

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
      .all(options.orgId, limit) as Array<{
      id: string;
      occurred_at: string;
      org_id: string | null;
      user_id: string | null;
      action: string;
      resource_type: string;
      resource_id: string | null;
      metadata_json: string;
    }>;
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
    .all(limit) as Array<{
    id: string;
    occurred_at: string;
    org_id: string | null;
    user_id: string | null;
    action: string;
    resource_type: string;
    resource_id: string | null;
    metadata_json: string;
  }>;
}
