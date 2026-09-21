export type DatabaseProvider = "sqlite" | "postgres";

const tableDefinitions = [
  {
    name: "organizations",
    sqlite: `
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE
      );
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE
      );
    `,
  },
  {
    name: "users",
    sqlite: `
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
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL REFERENCES organizations (id),
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL
      );
    `,
  },
  {
    name: "sessions",
    sqlite: `
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        org_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (org_id) REFERENCES organizations (id)
      );
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users (id),
        org_id TEXT NOT NULL REFERENCES organizations (id),
        expires_at TEXT NOT NULL
      );
    `,
  },
  {
    name: "user_states",
    sqlite: `
      CREATE TABLE IF NOT EXISTS user_states (
        state_key TEXT PRIMARY KEY,
        watchlist_json TEXT NOT NULL,
        notes_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS user_states (
        state_key TEXT PRIMARY KEY,
        watchlist_json TEXT NOT NULL,
        notes_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    name: "audit_events",
    sqlite: `
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
    `,
    postgres: `
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
    `,
  },
  {
    name: "pilot_leads",
    sqlite: `
      CREATE TABLE IF NOT EXISTS pilot_leads (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        company TEXT NOT NULL,
        role TEXT,
        market_focus TEXT,
        team_size TEXT,
        notes TEXT NOT NULL
      );
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS pilot_leads (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        company TEXT NOT NULL,
        role TEXT,
        market_focus TEXT,
        team_size TEXT,
        notes TEXT NOT NULL
      );
    `,
  },
] as const;

export function buildSchemaSql(provider: DatabaseProvider): string {
  return tableDefinitions.map((definition) => definition[provider].trim()).join("\n\n");
}

export function listSchemaTables() {
  return tableDefinitions.map((definition) => definition.name);
}
