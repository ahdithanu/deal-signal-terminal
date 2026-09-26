# Public API Platform

## Customer Problem

Acquisition teams and data partners need to bring opportunity signals into their own CRM,
warehouse, and analysis tools without copying records from the application or sharing a human
login. Organization API keys give each integration its own read-only permissions, request budget,
expiration, and revocation lifecycle. Administrators can inspect recent requests when debugging
an integration without exposing its credential again.

## Data Boundary

The current opportunity catalog is **public-source and shared across organizations**. An API key
identifies the organization responsible for access and usage; it does not turn this catalog into
a private, organization-specific dataset. Key administration and request-log visibility are scoped
to the authenticated administrator's organization.

The public API excludes private notes, generated memos, watchlists, review/workflow state, and
other customer workspace data. Graph access is restricted to public-source opportunity
relationships, not a blanket permission to query internal graph entities. Do not add private
enrichment by serializing an internal workspace object into these responses. Future customer-owned
datasets require explicit organization filtering and cross-organization isolation tests before
being exposed.

## Architecture

- `/admin/public-api` checks the server-side session, redirects unauthenticated users and demo
  sessions to `/login`, and redirects non-admin users to `/`. Only then does it load keys and recent requests for
  `session.orgId` through `listPublicApiKeys` and `listPublicApiRequestLogs`.
- `PublicApiConsole` receives key metadata, recent request logs, and `publicApiScopes`. It uses
  the session-authenticated `/api/admin/public-api` control plane for creation, refresh, and
  revocation. Organization and creator identity must come from the server session, never a
  client-supplied organization ID. The route must independently enforce admin authorization.
- `/api/v1/...` is the integration data plane: authenticate the bearer credential, resolve its
  organization, check revocation/expiration and the required scope, enforce its rate limit, then
  serve the public-source projection. Application session cookies are not integration credentials.
- Durable key metadata includes the ID, organization, name, prefix and last four characters,
  scopes, status, rate limit, expiration, last use, creator, creation time, and revocation time.
  Credential verification belongs on the server; store a one-way verifier rather than a
  recoverable plaintext secret. Only the creation response returns the raw secret.
- Request records include organization/key identity, method, route, HTTP status, latency,
  request ID, error message, and timestamp. Logs must not contain authorization headers, raw
  secrets, response bodies, or private workspace content. Keep operational errors sanitized.

The UI retains the returned secret only in component memory. It does not put it into local or
session storage, cookies, URLs, or server-rendered initial props. Save and dismiss it before
creating another key. Refreshing the list cannot recover a lost secret; navigation or reload
discards it. The key table displays only the prefix and last four characters.

## Admin Contract

All three operations use the administrator's existing same-origin session and JSON responses.
API keys cannot administer other API keys. Error responses use `{ "error": "message" }`.
Demo sessions cannot view or manage API keys or request logs, even when their session role is
`admin`. Both the page and admin API deny demo access. Sign in using an ordinary, non-demo
administrator account and password to manage integration credentials.

| Method | Path | Request | Success response |
| --- | --- | --- | --- |
| GET | `/api/admin/public-api` | None | `{ keys, requestLogs, scopes }` |
| POST | `/api/admin/public-api` | `{ name, scopes, rateLimitPerMinute, expiresAt? }` | `{ key, secret }` |
| DELETE | `/api/admin/public-api` | `{ keyId }` | `{ "ok": true }` |

`expiresAt`, when supplied, is an ISO 8601 timestamp. The console accepts a local date/time and
converts it to UTC. Leaving it blank omits the field. The UI validates a nonblank name, at least
one supported scope, a positive integer per-minute rate, and a future expiration. The service is
the authority for validation and policy bounds. The console starts at 60 requests per minute;
that is a form default, not a throughput guarantee.

Actions are serialized to avoid duplicate submissions or stale refresh races. Failed refreshes
preserve previously loaded data. Network failures, timeouts, non-JSON responses, unexpected
response shapes, and API error messages are surfaced without leaving controls permanently
pending. The console does not automatically retry mutations: a failed POST response may still
mean a key was created. Refresh, revoke any key whose secret was lost, then create a replacement.
Likewise, refresh after an uncertain DELETE to verify its outcome.

## Read-Only Endpoints

Send `Authorization: Bearer <secret>` over HTTPS. Never put credentials in query parameters,
frontend bundles, source control, screenshots, or support messages.

| Method | Endpoint | Required scope | Purpose |
| --- | --- | --- | --- |
| GET | `/api/v1/opportunities` | `opportunities:read` | List and filter the shared catalog |
| GET | `/api/v1/opportunities/[slug]` | `opportunities:read` | Read one opportunity by slug |
| GET | `/api/v1/opportunities/[slug]/graph` | `opportunities:graph:read` | Read its public-source relationship graph |

Select both scopes when a client needs opportunity records and graphs. Neither scope grants
writes or access to private notes, memos, or workflow data.

The list endpoint accepts these query parameters:

| Parameter | Meaning |
| --- | --- |
| `limit` | Integer page size from `1` to `100`; defaults to `25` |
| `cursor` | Nonnegative integer **offset**, not an opaque/keyset cursor; defaults to `0` |
| `marketId` | Filter by the catalog's market identifier |
| `opportunityType` | Filter by `development`, `value_add`, `distress`, `leasing`, or `repositioning` |
| `minScore` | Minimum integer priority score from `0` to `100`; defaults to `0` |

The list returns `{ data, pagination: { limit, nextCursor, totalReturned }, meta: { totalAvailable },
requestId }`, ordered by descending priority score and then ID. Detail and graph endpoints return
`{ data, requestId }`. Use `pagination.nextCursor` as the next request's `cursor`; `null` means the
end of the result set. Keep filters fixed while paging. Offset pagination is not a stable snapshot:
catalog changes between pages can shift
records, causing duplicates or omissions. Consumers should deduplicate by opportunity ID, and
must not interpret an offset as a durable synchronization checkpoint.

### Curl Examples

Set `BUILD_SIGNALS_BASE_URL` to your deployment's HTTPS origin. Have your secret manager inject
`BUILD_SIGNALS_API_KEY` into the shell environment; do not paste a real key into saved commands.

```sh
export BUILD_SIGNALS_BASE_URL='https://your-build-signals-host.example'

# First page. Set MARKET_ID to a market identifier from your catalog.
curl --fail-with-body --get "$BUILD_SIGNALS_BASE_URL/api/v1/opportunities" \
  --header "Authorization: Bearer $BUILD_SIGNALS_API_KEY" \
  --header 'Accept: application/json' \
  --data-urlencode 'limit=25' \
  --data-urlencode 'cursor=0' \
  --data-urlencode "marketId=$MARKET_ID" \
  --data-urlencode 'opportunityType=development' \
  --data-urlencode 'minScore=70'

# Set OPPORTUNITY_SLUG to a slug returned by the list response.
curl --fail-with-body "$BUILD_SIGNALS_BASE_URL/api/v1/opportunities/$OPPORTUNITY_SLUG" \
  --header "Authorization: Bearer $BUILD_SIGNALS_API_KEY" \
  --header 'Accept: application/json'

# Requires opportunities:graph:read in addition to any record-reading needs.
curl --fail-with-body "$BUILD_SIGNALS_BASE_URL/api/v1/opportunities/$OPPORTUNITY_SLUG/graph" \
  --header "Authorization: Bearer $BUILD_SIGNALS_API_KEY" \
  --header 'Accept: application/json'
```

Use status codes and the JSON `error` message to diagnose failures. Fix invalid query values
rather than retrying them. Check the credential and its expiration/revocation for authentication
failures, and check scopes for authorization failures. Respect `Retry-After` when a rate-limited
response supplies it; otherwise use bounded exponential backoff with jitter. Retry read requests
conservatively on transient failures, not indefinitely. Share a request ID with an administrator,
never the bearer credential. Responses include an `X-Request-Id` header, including on errors;
successful JSON responses also include `requestId`. Admin logs show recent activity only, not a
complete billing ledger. Requests with unknown credentials cannot be assigned to an organization
and do not appear in its logs. Logging failures can also leave gaps in this recent activity view.

## Key Rotation

1. Sign in with a non-demo organization admin account and open `/admin/public-api`. Identify the integration's
   current key by name, prefix, and last four characters.
2. Create a replacement key with only the required scopes, an appropriate per-minute budget,
   and preferably an expiration. Use a name that identifies the integration and rotation.
3. Store the one-time secret directly in your secret manager, then dismiss it. If it is lost,
   revoke that key and create another; there is no reveal or recovery operation.
4. Deploy the replacement credential to the integration. During a planned rotation, leave the
   old key active only for the controlled overlap needed to migrate clients.
5. Make a read request with the new key and refresh recent requests to verify successful use
   of its key ID. Check every client instance has switched before ending the overlap.
6. Revoke the old key, confirm the action, and verify subsequent requests with it are denied.
   Revocation is irreversible; it is not a temporary pause. Remove the old credential from
   your secret manager and deployment configuration after the cutover.

For suspected compromise, revoke immediately rather than waiting for an overlap window. Replace
the credential, inspect recent requests and longer-term operational logs, and review which
integrations or environments had access. Expiration is a safety net, not a rotation mechanism.

## Tradeoffs

- Scoped organization keys are simpler for service-to-service reads than delegated OAuth, but
  remain bearer credentials. They do not impersonate a user or replace per-user authorization.
- One-time disclosure reduces accidental exposure. It also means lost responses are not
  recoverable; a future idempotent creation design must not re-expose plaintext secrets.
- The shared public-source catalog makes useful integrations possible now. It is not evidence
  that customer-owned records are safe to expose through the same projection.
- Offset pagination is easy to integrate with, but deep offsets and concurrent updates make it
  unsuitable for large, reliable incremental exports. A future version should introduce an
  indexed keyset cursor with deterministic ordering and a snapshot/change watermark.
- Request-level logs aid troubleshooting, but synchronous writes and unbounded retention become
  expensive. The admin console intentionally shows a recent window rather than loading history.
- Process-local rate limits cannot enforce a global budget across replicas. Before horizontal
  scaling, verify the public API limiter uses atomic shared state and clearly define its failure
  policy; do not infer distributed protection from a configured per-minute value alone.

## Scaling Toward One Million

This is a capacity plan, not a claim that the current deployment has been load-tested at one
million. Treat **one million opportunities** and **one million API requests per day** as separate
targets. One million requests/day averages about 11.6 requests/second; burst traffic and graph
cost matter more than that average.

1. Materialize the public opportunity projection in an indexed database rather than rebuilding
   and filtering the entire catalog on each request. Use query-plan evidence to choose indexes
   for market, type, score, and stable ID ordering. Add bounded keyset pagination and separate
   asynchronous bulk exports for million-record consumers.
2. Serve stateless API replicas with bounded database connection pools and cached public
   projections. Keep authentication and quota checks ahead of cache access. Cache keys must
   include filters, cursor, API/schema version, and catalog revision; introduce organization
   partitioning before any tenant-specific projection. Never cache admin secrets or key-creation
   responses. Bound graph traversal, response sizes, and execution time.
3. Enforce per-key and organization-wide budgets with an atomic shared limiter. Organization
   budgets prevent a customer from bypassing limits by creating more keys. Bound credential
   verification caches and provide prompt revocation invalidation across replicas. Rate-limit
   invalid-credential traffic before expensive work without attributing it to another tenant.
4. Move high-volume request telemetry to a bounded queue and batch writes. Define overload and
   delivery behavior explicitly; durable security/audit events should not depend on best-effort
   usage sampling. Partition logs by time, index organization/time and key/time, aggregate usage,
   and apply documented retention/archive policies. Keep admin reads bounded and paginated.
5. Load-test a million-record dataset and production-like bursts, including costly graph reads,
   cold caches, expired keys, revocation races, and cross-organization attempts. Measure p95/p99
   latency, database load, cache hit rate, quota accuracy, queue lag, error rates, and recovery
   under dependency failure. Set rollout gates from those results rather than average RPS.

Keep these scaling changes behind explicit API compatibility and data-isolation tests. None of
them should expand the read-only contract or leak notes, memos, or workflow data into the shared
catalog.
