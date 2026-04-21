import { afterEach, beforeEach, describe, expect, it } from "vitest";

const TEST_DB_PATH = `${process.cwd()}/.data/test-user-state.db`;

describe("user state persistence", () => {
  beforeEach(async () => {
    process.env.BUILD_SIGNALS_DB_PATH = TEST_DB_PATH;
    const userState = await import("@/lib/user-state");
    userState.__testing.resetStorage();
  });

  afterEach(async () => {
    const userState = await import("@/lib/user-state");
    userState.__testing.resetStorage();
    delete process.env.BUILD_SIGNALS_DB_PATH;
  });

  it("persists watchlist and notes in sqlite-backed user state", async () => {
    const userState = await import("@/lib/user-state");

    await userState.updateUserState("org-1:user-1", () => ({
      watchlist: {
        opp1: {
          savedAt: "2026-04-18T12:00:00.000Z",
          snapshot: {
            priorityScore: 88,
            confidenceLevel: "high",
            developmentStage: "pre_construction",
            latestTimelineDate: "2026-04-18",
          },
        },
      },
      notes: {
        opp1: {
          body: "Call seller rep",
          savedAt: "2026-04-18T12:00:00.000Z",
        },
      },
    }));

    const persisted = await userState.getUserState("org-1:user-1");

    expect(persisted.watchlist.opp1?.snapshot?.priorityScore).toBe(88);
    expect(persisted.notes.opp1?.body).toBe("Call seller rep");
  });
});
