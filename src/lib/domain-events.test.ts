import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const TEST_DB_PATH = `${process.cwd()}/.data/test-domain-events.db`;

describe("domain events", () => {
  beforeEach(async () => {
    process.env.BUILD_SIGNALS_DB_PROVIDER = "sqlite";
    process.env.BUILD_SIGNALS_DB_PATH = TEST_DB_PATH;

    const dbModule = await import("@/lib/db");
    dbModule.resetDatabaseForTests();
  });

  afterEach(async () => {
    const dbModule = await import("@/lib/db");
    dbModule.resetDatabaseForTests();
    delete process.env.BUILD_SIGNALS_DB_PROVIDER;
    delete process.env.BUILD_SIGNALS_DB_PATH;
  });

  it("publishes events into the durable outbox", async () => {
    const { publishDomainEvent, getEventDashboard } = await import("@/lib/domain-events");

    const event = await publishDomainEvent({
      eventType: "copilot.run.completed",
      aggregateType: "copilot_response",
      aggregateId: "response-1",
      orgId: "org-1",
      userId: "user-1",
      payload: { intent: "summarize_opportunity", citationCount: 3 },
    });
    const dashboard = await getEventDashboard();

    expect(event.status).toBe("pending");
    expect(dashboard.pending).toBe(1);
    expect(dashboard.recentEvents[0]?.payload).toEqual({
      intent: "summarize_opportunity",
      citationCount: 3,
    });
  });

  it("dispatches pending events and marks them published", async () => {
    const { publishDomainEvent, dispatchPendingDomainEvents, getEventDashboard } = await import(
      "@/lib/domain-events"
    );

    await publishDomainEvent({
      eventType: "eval.run.completed",
      aggregateType: "eval_run",
      aggregateId: "eval-1",
      payload: { gatePassed: true },
    });

    const result = await dispatchPendingDomainEvents();
    const dashboard = await getEventDashboard();

    expect(result).toEqual({ scanned: 1, published: 1, failed: 0 });
    expect(dashboard.pending).toBe(0);
    expect(dashboard.published).toBe(1);
    expect(dashboard.recentEvents[0]?.attempts).toBe(1);
  });
});
