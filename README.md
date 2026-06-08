# Build Signals

Build Signals is a developer-grade real estate intelligence app that turns public permit activity into ranked development opportunities.

## Stack

- Next.js App Router
- TypeScript
- React 19
- SQLite-backed local persistence today, with Postgres adapter work and data ingestion groundwork now in place
- Rules-based scoring with fact-safe memo generation

## Local development

```bash
npm ci
npm run dev
```

## Verification

```bash
npm run verify
```

To smoke-test a running instance:

```bash
SMOKE_BASE_URL=http://localhost:3000 \
SMOKE_EMAIL=admin@buildsignals.local \
SMOKE_PASSWORD=change-me-now \
npm run smoke
```

## Environment

Copy `.env.example` to `.env.local` if you want live OpenAI memo generation.

- `OPENAI_API_KEY`: optional; if missing, the app falls back to deterministic rules-based memos
- `OPENAI_MODEL`: optional; defaults to `gpt-4.1-mini`
- `LOG_LEVEL`: optional; `debug`, `info`, `warn`, or `error`
- `BUILD_SIGNALS_BOOTSTRAP_EMAIL`: bootstrap login email for the local auth store
- `BUILD_SIGNALS_BOOTSTRAP_PASSWORD`: bootstrap password for the local auth store
- `BUILD_SIGNALS_BOOTSTRAP_ORG_NAME`: organization name shown in the app shell
- `BUILD_SIGNALS_BOOTSTRAP_ORG_SLUG`: organization slug used in the auth store
- `BUILD_SIGNALS_EXPOSE_DEMO_CREDENTIALS`: set to `true` if you want the login screen to show the seeded demo workspace and one-click demo entry in production
- `BUILD_SIGNALS_DB_PROVIDER`: `sqlite` (default) or `postgres`
- `BUILD_SIGNALS_DATABASE_URL`: required when `BUILD_SIGNALS_DB_PROVIDER=postgres`
- `BUILD_SIGNALS_DB_PATH`: optional override for the SQLite file path
- `CRON_SECRET`: bearer token Vercel sends to scheduled ingestion endpoints; required for
  cron route execution

## Postgres migration foundation

The app still runs on SQLite by default, but the Postgres migration layer is now in place for the core persisted workflows:

- canonical schema definitions live in `src/lib/db-schema.ts`
- a bootstrap SQL file for Postgres lives in `scripts/postgres-bootstrap.sql`
- the health endpoint now reports which database provider is configured
- auth, sessions, pilot leads, audit events, and user state have provider-aware adapters

Set `BUILD_SIGNALS_DB_PROVIDER=postgres` and `BUILD_SIGNALS_DATABASE_URL` to run the migrated persistence paths against Postgres.

## Data ingestion foundation

Build Signals now has the storage layer needed for real permit ingestion:

- `source_documents` tracks report files, source URLs, report windows, checksums, and access timing
- `permit_records` stores normalized raw permit rows with source-document lineage
- `ingestion_runs` records run status, counts, failures, and timing
- admin users can review coverage and ingestion status at `/admin/data-health`
- admin users can run the El Dorado normalized-source load or the San Diego development approvals
  load from `/admin/data-health`
- Vercel Cron runs the all-market ingest daily via `/api/cron/ingest/all`

The current El Dorado ingest loads the normalized permit signals already represented in the
application into the durable ingestion tables. The San Diego ingest fetches the official City of
San Diego 2026 issued development approvals CSV, filters for higher-signal development approvals,
and stores the top normalized records with source lineage. The next data step is turning the
second market's raw permit records into scored opportunities.

## Deployment

The app is configured for Next.js deployment on Vercel or any Node 22-compatible host.

`vercel.json` schedules the all-market ingestion route daily at 13:00 UTC. Set `CRON_SECRET`
in Vercel so scheduled requests include `Authorization: Bearer <secret>`. Use the same header
for manual operator runs without a browser session.

## Operational checks

- `GET /api/health` returns a lightweight health payload for uptime monitoring.
- `GET /api/health` also reports the configured database provider so environment drift is easier to spot.
- Server routes now emit structured JSON logs for auth and persistence activity.
- Auth, org state, watchlist state, and notes now persist in `.data/build-signals.db`.
- Admin users can review the recent audit trail at `/admin/audit`.
- Admin users can review source coverage and ingestion status at `/admin/data-health`.
