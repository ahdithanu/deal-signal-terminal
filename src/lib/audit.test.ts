import { afterEach, beforeEach, describe, expect, it } from "vitest";

const TEST_DB_PATH = `${process.cwd()}/.data/test-audit.db`;

describe("audit persistence", () => {
  beforeEach(async () => {
    process.env.BUILD_SIGNALS_DB_PATH = TEST_DB_PATH;
    const auth = await import("@/lib/auth");
    auth.__testing.resetStorage();
  });

  afterEach(async () => {
    const auth = await import("@/lib/auth");
    auth.__testing.resetStorage();
    delete process.env.BUILD_SIGNALS_DB_PATH;
  });

  it("records and returns recent audit events in descending order", async () => {
    const audit = await import("@/lib/audit");

    audit.recordAuditEvent({
      orgId: "org-1",
      userId: "user-1",
      action: "watchlist.add",
      resourceType: "opportunity",
      resourceId: "opp-1",
      metadata: { source: "watchlist" },
    });
    audit.recordAuditEvent({
      orgId: "org-1",
      userId: "user-1",
      action: "note.upsert",
      resourceType: "opportunity",
      resourceId: "opp-1",
      metadata: { size: 42 },
    });

    const events = audit.listRecentAuditEvents();

    expect(events).toHaveLength(2);
    expect(events[0].action).toBe("note.upsert");
    expect(events[1].action).toBe("watchlist.add");
    expect(JSON.parse(events[0].metadata_json)).toEqual({ size: 42 });
  });

  it("filters audit events by org when requested", async () => {
    const audit = await import("@/lib/audit");

    audit.recordAuditEvent({
      orgId: "org-1",
      userId: "user-1",
      action: "watchlist.add",
      resourceType: "opportunity",
      resourceId: "opp-1",
    });
    audit.recordAuditEvent({
      orgId: "org-2",
      userId: "user-2",
      action: "watchlist.add",
      resourceType: "opportunity",
      resourceId: "opp-2",
    });

    const events = audit.listRecentAuditEvents({ orgId: "org-1" });

    expect(events).toHaveLength(1);
    expect(events[0].org_id).toBe("org-1");
    expect(events[0].resource_id).toBe("opp-1");
  });
});
