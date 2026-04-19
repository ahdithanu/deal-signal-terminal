import type { NoteRecord, UserState, WatchlistEntry, WatchlistSnapshot } from "@/types/domain";
import { closeDatabase, getDatabase, resetDatabaseForTests } from "@/lib/db";

function emptyUserState(): UserState {
  return {
    watchlist: {},
    notes: {},
  };
}

function isWatchlistSnapshot(value: unknown): value is WatchlistSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const snapshot = value as Partial<WatchlistSnapshot>;
  return (
    typeof snapshot.priorityScore === "number" &&
    (snapshot.confidenceLevel === "high" ||
      snapshot.confidenceLevel === "medium" ||
      snapshot.confidenceLevel === "low") &&
    (snapshot.developmentStage === "early_signal" ||
      snapshot.developmentStage === "pre_construction" ||
      snapshot.developmentStage === "active_construction" ||
      snapshot.developmentStage === "disruption") &&
    (snapshot.latestTimelineDate === null || typeof snapshot.latestTimelineDate === "string")
  );
}

function sanitizeWatchlistEntry(value: unknown): WatchlistEntry | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const entry = value as Partial<WatchlistEntry>;

  if (typeof entry.savedAt !== "string") {
    return null;
  }

  if (entry.snapshot && !isWatchlistSnapshot(entry.snapshot)) {
    return null;
  }

  return {
    savedAt: entry.savedAt,
    snapshot: entry.snapshot,
  };
}

function sanitizeNoteRecord(value: unknown): NoteRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const note = value as Partial<NoteRecord>;

  if (typeof note.body !== "string" || typeof note.savedAt !== "string") {
    return null;
  }

  return {
    body: note.body,
    savedAt: note.savedAt,
  };
}

function sanitizeUserState(value: unknown): UserState {
  if (!value || typeof value !== "object") {
    return emptyUserState();
  }

  const candidate = value as Partial<UserState>;
  const watchlist = Object.fromEntries(
    Object.entries(candidate.watchlist ?? {}).flatMap(([opportunityId, entry]) => {
      const sanitized = sanitizeWatchlistEntry(entry);
      return sanitized ? [[opportunityId, sanitized]] : [];
    })
  );
  const notes = Object.fromEntries(
    Object.entries(candidate.notes ?? {}).flatMap(([opportunityId, note]) => {
      const sanitized = sanitizeNoteRecord(note);
      return sanitized ? [[opportunityId, sanitized]] : [];
    })
  );

  return {
    watchlist,
    notes,
  };
}

export async function getUserState(stateKey: string): Promise<UserState> {
  const db = getDatabase();
  const row = db
    .prepare("SELECT watchlist_json, notes_json FROM user_states WHERE state_key = ?")
    .get(stateKey) as { watchlist_json: string; notes_json: string } | undefined;

  if (!row) {
    return emptyUserState();
  }

  return sanitizeUserState({
    watchlist: JSON.parse(row.watchlist_json),
    notes: JSON.parse(row.notes_json),
  });
}

export async function updateUserState(
  stateKey: string,
  updater: (state: UserState) => UserState
): Promise<UserState> {
  const db = getDatabase();
  const current = await getUserState(stateKey);
  const next = sanitizeUserState(updater(current));
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO user_states (state_key, watchlist_json, notes_json, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(state_key) DO UPDATE SET
       watchlist_json = excluded.watchlist_json,
       notes_json = excluded.notes_json,
       updated_at = excluded.updated_at`
  ).run(stateKey, JSON.stringify(next.watchlist), JSON.stringify(next.notes), now);

  return next;
}

export const __testing = {
  sanitizeUserState,
  resetStorage() {
    resetDatabaseForTests();
    closeDatabase();
  },
};
