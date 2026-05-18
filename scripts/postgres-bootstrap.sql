CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations (id),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id),
  org_id TEXT NOT NULL REFERENCES organizations (id),
  expires_at TEXT NOT NULL
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
