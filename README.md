# Build Signals

Build Signals is a developer-grade real estate intelligence app that turns public permit activity into ranked development opportunities.

## Stack

- Next.js App Router
- TypeScript
- React 19
- SQLite-backed local persistence for auth and user state
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

## Deployment

The app is configured for Next.js deployment on Vercel or any Node 22-compatible host.

## Operational checks

- `GET /api/health` returns a lightweight health payload for uptime monitoring.
- Server routes now emit structured JSON logs for auth and persistence activity.
- Auth, org state, watchlist state, and notes now persist in `.data/build-signals.db`.
- Admin users can review the recent audit trail at `/admin/audit`.
