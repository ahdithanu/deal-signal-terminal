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

CREATE TABLE IF NOT EXISTS source_documents (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  document_url TEXT NOT NULL,
  report_label TEXT NOT NULL,
  reporting_period_start TEXT,
  reporting_period_end TEXT,
  published_at TEXT,
  accessed_at TEXT NOT NULL,
  checksum TEXT,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS permit_records (
  id TEXT PRIMARY KEY,
  source_document_id TEXT NOT NULL REFERENCES source_documents (id),
  market_id TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  permit_number TEXT NOT NULL,
  permit_type TEXT NOT NULL,
  permit_subtype TEXT,
  status TEXT,
  applied_date TEXT,
  issued_date TEXT,
  finaled_date TEXT,
  address TEXT,
  city TEXT,
  parcel_number TEXT,
  applicant TEXT,
  contractor TEXT,
  valuation DOUBLE PRECISION,
  description TEXT NOT NULL,
  raw_json TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (market_id, permit_number)
);

CREATE TABLE IF NOT EXISTS ingestion_runs (
  id TEXT PRIMARY KEY,
  source_document_id TEXT REFERENCES source_documents (id),
  market_id TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  records_found INTEGER NOT NULL DEFAULT 0,
  records_inserted INTEGER NOT NULL DEFAULT 0,
  records_updated INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  metadata_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS graph_entities (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  display_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  source_system TEXT,
  source_id TEXT,
  properties_json TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_verified_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS graph_entities_type_name_idx
  ON graph_entities (entity_type, normalized_name);
CREATE INDEX IF NOT EXISTS graph_entities_source_idx
  ON graph_entities (entity_type, source_system, source_id);

CREATE TABLE IF NOT EXISTS graph_entity_aliases (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES graph_entities (id),
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  alias_type TEXT NOT NULL,
  source_system TEXT,
  source_id TEXT,
  confidence DOUBLE PRECISION NOT NULL,
  created_at TEXT NOT NULL,
  last_verified_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS graph_entity_aliases_lookup_idx
  ON graph_entity_aliases (normalized_alias, alias_type);
CREATE INDEX IF NOT EXISTS graph_entity_aliases_entity_idx
  ON graph_entity_aliases (entity_id);

CREATE TABLE IF NOT EXISTS graph_relationships (
  id TEXT PRIMARY KEY,
  from_entity_id TEXT NOT NULL REFERENCES graph_entities (id),
  to_entity_id TEXT NOT NULL REFERENCES graph_entities (id),
  relationship_type TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  source_system TEXT,
  source_id TEXT,
  provenance_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_verified_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS graph_relationships_from_idx
  ON graph_relationships (from_entity_id, relationship_type);
CREATE INDEX IF NOT EXISTS graph_relationships_to_idx
  ON graph_relationships (to_entity_id, relationship_type);
CREATE INDEX IF NOT EXISTS graph_relationships_source_idx
  ON graph_relationships (source_system, source_id);

CREATE TABLE IF NOT EXISTS graph_relationship_evidence (
  id TEXT PRIMARY KEY,
  relationship_id TEXT NOT NULL REFERENCES graph_relationships (id),
  evidence_key TEXT NOT NULL,
  label TEXT NOT NULL,
  report_label TEXT NOT NULL,
  url TEXT,
  page_url TEXT,
  record_id TEXT,
  published_at TEXT,
  accessed_at TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS graph_relationship_evidence_relationship_idx
  ON graph_relationship_evidence (relationship_id);
