import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type LoadedModules = {
  auth: typeof import("@/lib/auth");
  audit: typeof import("@/lib/audit");
  pilotLeads: typeof import("@/lib/pilot-leads");
  userState: typeof import("@/lib/user-state");
  db: typeof import("@/lib/db");
};

const TEST_DATABASE_URL = "postgres://build-signals:test@localhost:5432/build-signals";

let loaded: LoadedModules | null = null;

async function loadPostgresModules(): Promise<LoadedModules> {
  vi.resetModules();
  vi.doMock("pg", async () => {
    const { newDb } = await import("pg-mem");
    const memoryDb = newDb();
    const adapter = memoryDb.adapters.createPg();

    return {
      Pool: adapter.Pool,
    };
  });

  loaded = {
    auth: await import("@/lib/auth"),
    audit: await import("@/lib/audit"),
    pilotLeads: await import("@/lib/pilot-leads"),
    userState: await import("@/lib/user-state"),
    db: await import("@/lib/db"),
  };

  return loaded;
}

describe("postgres-backed persistence", () => {
  beforeEach(() => {
    process.env.BUILD_SIGNALS_DB_PROVIDER = "postgres";
    process.env.BUILD_SIGNALS_DATABASE_URL = TEST_DATABASE_URL;
    process.env.BUILD_SIGNALS_BOOTSTRAP_EMAIL = "admin@test.local";
    process.env.BUILD_SIGNALS_BOOTSTRAP_PASSWORD = "super-secret";
    process.env.BUILD_SIGNALS_BOOTSTRAP_ORG_NAME = "Test Org";
    process.env.BUILD_SIGNALS_BOOTSTRAP_ORG_SLUG = "test-org";
  });

  afterEach(async () => {
    if (loaded) {
      await loaded.auth.__testing.resetStorage();
      await loaded.userState.__testing.resetStorage();
    }

    loaded = null;
    vi.doUnmock("pg");
    vi.resetModules();
    delete process.env.BUILD_SIGNALS_DB_PROVIDER;
    delete process.env.BUILD_SIGNALS_DATABASE_URL;
    delete process.env.BUILD_SIGNALS_BOOTSTRAP_EMAIL;
    delete process.env.BUILD_SIGNALS_BOOTSTRAP_PASSWORD;
    delete process.env.BUILD_SIGNALS_BOOTSTRAP_ORG_NAME;
    delete process.env.BUILD_SIGNALS_BOOTSTRAP_ORG_SLUG;
  });

  it("reports postgres as a runtime-ready provider when a database url is configured", async () => {
    const { db } = await loadPostgresModules();

    expect(db.getDatabaseInfo()).toEqual({
      provider: "postgres",
      sqlitePath: null,
      postgresUrlConfigured: true,
      runtimeReady: true,
    });
  });

  it("creates and restores auth sessions against the postgres adapter", async () => {
    const { auth } = await loadPostgresModules();

    const session = await auth.loginWithPassword("admin@test.local", "super-secret");
    const restored = await auth.getAuthSessionByToken(session?.token);

    expect(session).not.toBeNull();
    expect(session?.orgName).toBe("Test Org");
    expect(restored?.userId).toBe(session?.userId);
    expect(restored?.orgSlug).toBe("test-org");
  });

  it("persists audit events and pilot leads against the postgres adapter", async () => {
    const { audit, pilotLeads } = await loadPostgresModules();

    await audit.recordAuditEvent({
      orgId: "org-1",
      userId: "user-1",
      action: "pilot.requested",
      resourceType: "pilot_lead",
      resourceId: "lead-1",
      metadata: { source: "landing-page" },
    });

    await pilotLeads.createPilotLead({
      id: "lead-1",
      createdAt: "2026-05-18T05:00:00.000Z",
      name: "Taylor Buyer",
      email: "taylor@example.com",
      company: "Signal Capital",
      role: "Principal",
      marketFocus: "Sacramento",
      teamSize: "6-10",
      notes: "Interested in a pilot",
    });

    const [events, leads] = await Promise.all([
      audit.listRecentAuditEvents({ orgId: "org-1" }),
      pilotLeads.listPilotLeads(),
    ]);

    expect(events).toHaveLength(1);
    expect(events[0]?.action).toBe("pilot.requested");
    expect(leads).toHaveLength(1);
    expect(leads[0]?.email).toBe("taylor@example.com");
  });

  it("persists watchlist and notes in postgres-backed user state", async () => {
    const { userState } = await loadPostgresModules();

    await userState.updateUserState("org-1:user-1", () => ({
      watchlist: {
        opp1: {
          savedAt: "2026-05-18T12:00:00.000Z",
          snapshot: {
            priorityScore: 91,
            confidenceLevel: "high",
            developmentStage: "pre_construction",
            latestTimelineDate: "2026-05-18",
          },
        },
      },
      notes: {
        opp1: {
          body: "Review entitlement timeline",
          savedAt: "2026-05-18T12:00:00.000Z",
        },
      },
    }));

    const persisted = await userState.getUserState("org-1:user-1");

    expect(persisted.watchlist.opp1?.snapshot?.priorityScore).toBe(91);
    expect(persisted.notes.opp1?.body).toBe("Review entitlement timeline");
  });
});
