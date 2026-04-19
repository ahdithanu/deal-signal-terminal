import { describe, expect, it } from "vitest";

import { __testing } from "@/lib/user-state";

describe("user state sanitization", () => {
  it("drops malformed watchlist and note records", () => {
    const sanitized = __testing.sanitizeUserState({
      watchlist: {
        keep: {
          savedAt: "2026-04-18T12:00:00.000Z",
          snapshot: {
            priorityScore: 85,
            confidenceLevel: "high",
            developmentStage: "pre_construction",
            latestTimelineDate: null,
          },
        },
        drop: {
          savedAt: 42,
        },
      },
      notes: {
        good: {
          body: "Call broker tomorrow",
          savedAt: "2026-04-18T12:00:00.000Z",
        },
        bad: {
          body: ["not", "valid"],
          savedAt: "2026-04-18T12:00:00.000Z",
        },
      },
    });

    expect(Object.keys(sanitized.watchlist)).toEqual(["keep"]);
    expect(Object.keys(sanitized.notes)).toEqual(["good"]);
  });
});
