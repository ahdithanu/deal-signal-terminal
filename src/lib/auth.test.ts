import { afterEach, beforeEach, describe, expect, it } from "vitest";

const TEST_DB_PATH = `${process.cwd()}/.data/test-auth.db`;

describe("auth persistence", () => {
  beforeEach(async () => {
    process.env.BUILD_SIGNALS_DB_PATH = TEST_DB_PATH;
    process.env.BUILD_SIGNALS_BOOTSTRAP_EMAIL = "admin@test.local";
    process.env.BUILD_SIGNALS_BOOTSTRAP_PASSWORD = "super-secret";
    process.env.BUILD_SIGNALS_BOOTSTRAP_ORG_NAME = "Test Org";
    process.env.BUILD_SIGNALS_BOOTSTRAP_ORG_SLUG = "test-org";

    const auth = await import("@/lib/auth");
    auth.__testing.resetStorage();
  });

  afterEach(async () => {
    const auth = await import("@/lib/auth");
    auth.__testing.resetStorage();
    delete process.env.BUILD_SIGNALS_DB_PATH;
    delete process.env.BUILD_SIGNALS_BOOTSTRAP_EMAIL;
    delete process.env.BUILD_SIGNALS_BOOTSTRAP_PASSWORD;
    delete process.env.BUILD_SIGNALS_BOOTSTRAP_ORG_NAME;
    delete process.env.BUILD_SIGNALS_BOOTSTRAP_ORG_SLUG;
    delete process.env.DST_BOOTSTRAP_EMAIL;
    delete process.env.DST_BOOTSTRAP_PASSWORD;
    delete process.env.DST_BOOTSTRAP_ORG_NAME;
    delete process.env.DST_BOOTSTRAP_ORG_SLUG;
  });

  it("creates a bootstrap user and returns an org-scoped session on login", async () => {
    const auth = await import("@/lib/auth");
    const session = await auth.loginWithPassword("admin@test.local", "super-secret");

    expect(session).not.toBeNull();
    expect(session?.email).toBe("admin@test.local");
    expect(session?.orgName).toBe("Test Org");
    expect(session?.orgSlug).toBe("test-org");
    expect(session?.role).toBe("admin");
  });

  it("restores a session from a persisted token", async () => {
    const auth = await import("@/lib/auth");
    const session = await auth.loginWithPassword("admin@test.local", "super-secret");
    const restored = await auth.getAuthSessionByToken(session?.token);

    expect(restored?.userId).toBe(session?.userId);
    expect(restored?.orgId).toBe(session?.orgId);
  });

  it("rejects invalid credentials", async () => {
    const auth = await import("@/lib/auth");
    const session = await auth.loginWithPassword("admin@test.local", "wrong-password");

    expect(session).toBeNull();
  });

  it("ignores legacy Deal Signal bootstrap identity when Build Signals env is absent", async () => {
    delete process.env.BUILD_SIGNALS_BOOTSTRAP_EMAIL;
    delete process.env.BUILD_SIGNALS_BOOTSTRAP_PASSWORD;
    delete process.env.BUILD_SIGNALS_BOOTSTRAP_ORG_NAME;
    delete process.env.BUILD_SIGNALS_BOOTSTRAP_ORG_SLUG;
    process.env.DST_BOOTSTRAP_EMAIL = "admin@dealsignal.local";
    process.env.DST_BOOTSTRAP_PASSWORD = "change-me-now";
    process.env.DST_BOOTSTRAP_ORG_NAME = "Deal Signal Capital";
    process.env.DST_BOOTSTRAP_ORG_SLUG = "deal-signal-capital";

    const auth = await import("@/lib/auth");
    auth.__testing.resetStorage();
    const session = await auth.loginWithPassword("admin@buildsignals.local", "change-me-now");

    expect(session?.email).toBe("admin@buildsignals.local");
    expect(session?.orgName).toBe("Build Signals");
    expect(session?.orgSlug).toBe("build-signals");
  });
});
