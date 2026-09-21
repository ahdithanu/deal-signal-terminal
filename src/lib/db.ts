import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { buildSchemaSql, type DatabaseProvider } from "@/lib/db-schema";

const DEFAULT_DATA_DIR = path.join(process.cwd(), ".data");
const DEFAULT_DB_FILE = path.join(DEFAULT_DATA_DIR, "build-signals.db");
const PRODUCTION_TMP_DB_FILE = "/tmp/build-signals.db";

let database: DatabaseSync | null = null;
let databasePath: string | null = null;

export type DatabaseInfo = {
  provider: DatabaseProvider;
  sqlitePath: string | null;
  postgresUrlConfigured: boolean;
};

export function resolveDatabaseProvider(): DatabaseProvider {
  const explicitProvider = process.env.BUILD_SIGNALS_DB_PROVIDER?.trim().toLowerCase();

  if (explicitProvider === "postgres") {
    return "postgres";
  }

  if (explicitProvider === "sqlite") {
    return "sqlite";
  }

  if (process.env.BUILD_SIGNALS_DATABASE_URL?.trim()) {
    return "postgres";
  }

  return "sqlite";
}

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
  db.exec(buildSchemaSql("sqlite"));
}

function getPostgresDatabaseUrl(): string {
  const url = process.env.BUILD_SIGNALS_DATABASE_URL?.trim();

  if (!url) {
    throw new Error(
      "BUILD_SIGNALS_DATABASE_URL must be set when BUILD_SIGNALS_DB_PROVIDER=postgres."
    );
  }

  return url;
}

export function getDatabaseInfo(): DatabaseInfo {
  const provider = resolveDatabaseProvider();

  return {
    provider,
    sqlitePath: provider === "sqlite" ? resolveDatabasePath() : null,
    postgresUrlConfigured: Boolean(process.env.BUILD_SIGNALS_DATABASE_URL?.trim()),
  };
}

export function getDatabase() {
  const provider = resolveDatabaseProvider();

  if (provider === "postgres") {
    const configuredUrl = getPostgresDatabaseUrl();
    throw new Error(
      `Postgres provider selected for Build Signals (${configuredUrl}), but the runtime adapter is not wired yet. Complete the Postgres query-layer migration before deploying with BUILD_SIGNALS_DB_PROVIDER=postgres.`
    );
  }

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
