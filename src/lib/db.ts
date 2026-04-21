import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const DEFAULT_DATA_DIR = path.join(process.cwd(), ".data");
const DEFAULT_DB_FILE = path.join(DEFAULT_DATA_DIR, "build-signals.db");
const PRODUCTION_TMP_DB_FILE = "/tmp/build-signals.db";

let database: DatabaseSync | null = null;
let databasePath: string | null = null;

function resolveDatabasePath(): string {
  const explicitPath = process.env.BUILD_SIGNALS_DB_PATH?.trim();

  if (explicitPath) {
    return explicitPath;
  }

  if (process.env.NODE_ENV === "production") {
    return PRODUCTION_TMP_DB_FILE;
  }

  return DEFAULT_DB_FILE;
}

function ensureDatabaseDir(filePath: string) {
  mkdirSync(path.dirname(filePath), { recursive: true });
}

function initializeDatabase(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      FOREIGN KEY (org_id) REFERENCES organizations (id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      org_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (org_id) REFERENCES organizations (id)
    );

    CREATE TABLE IF NOT EXISTS user_states (
      state_key TEXT PRIMARY KEY,
      watchlist_json TEXT NOT NULL,
      notes_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      occurred_at TEXT NOT NULL,
      org_id TEXT,
      user_id TEXT,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      metadata_json TEXT NOT NULL
    );
  `);
}

export function getDatabase() {
  const nextPath = resolveDatabasePath();

  if (database && databasePath === nextPath) {
    return database;
  }

  if (database) {
    database.close();
    database = null;
  }

  ensureDatabaseDir(nextPath);
  database = new DatabaseSync(nextPath);
  databasePath = nextPath;
  initializeDatabase(database);
  return database;
}

export function closeDatabase() {
  if (database) {
    database.close();
    database = null;
    databasePath = null;
  }
}

export function resetDatabaseForTests() {
  const nextPath = resolveDatabasePath();
  closeDatabase();

  if (existsSync(nextPath)) {
    unlinkSync(nextPath);
  }
}
