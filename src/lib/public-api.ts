import "server-only";

import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { getDatabase, resolveDatabaseProvider } from "@/lib/db";
import { queryPostgres } from "@/lib/postgres";
import {
  publicApiScopes,
  type PublicApiKeyRecord,
  type PublicApiRateLimitState,
  type PublicApiRequestLog,
  type PublicApiScope,
} from "@/types/public-api";

export { publicApiScopes };

const KEY_PREFIX = "bs_live";
const DEFAULT_RATE_LIMIT = 60;
const MAX_RATE_LIMIT = 1_000;

export class PublicApiValidationError extends Error {}

type PublicApiKeyRow = {
  id: string;
  org_id: string;
  name: string;
  key_prefix: string;
  key_last4: string;
  secret_hash: string;
  scopes_json: string;
  status: "active" | "revoked";
  rate_limit_per_minute: number;
  expires_at: string | null;
  last_used_at: string | null;
  created_by_user_id: string | null;
  created_at: string;
  revoked_at: string | null;
};

type PublicApiRequestLogRow = {
  id: string;
  org_id: string | null;
  api_key_id: string | null;
  route: string;
  method: string;
  status_code: number;
  latency_ms: number;
  request_id: string;
  error_message: string | null;
  created_at: string;
};

type CreateKeyInput = {
  orgId: string;
  userId: string;
  name: unknown;
  scopes: unknown;
  rateLimitPerMinute?: unknown;
  expiresAt?: unknown;
};

type RevokeKeyInput = {
  orgId: string;
  keyId: string;
};

type RecordRequestInput = {
  orgId: string;
  apiKeyId: string;
  route: string;
  method: string;
  statusCode: number;
  latencyMs: number;
  requestId: string;
  errorMessage?: string | null;
};

type AuthenticatedPrincipal = {
  orgId: string;
  keyId: string;
  scopes: PublicApiScope[];
};

const rateLimitBuckets = new Map<string, { count: number; resetAtMs: number }>();

function nowIso() {
  return new Date().toISOString();
}

function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

function createSecret() {
  return `${KEY_PREFIX}_${randomBytes(24).toString("base64url")}`;
}

function isScope(value: unknown): value is PublicApiScope {
  return (publicApiScopes as readonly string[]).includes(String(value));
}

function parseScopes(value: string): PublicApiScope[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.some((scope) => !isScope(scope))) return [];
  return parsed;
}

function validateScopes(value: unknown): PublicApiScope[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new PublicApiValidationError("Select at least one API scope.");
  }
  const unique = [...new Set(value)];
  if (unique.some((scope) => !isScope(scope))) {
    throw new PublicApiValidationError("One or more API scopes are not supported.");
  }
  return unique as PublicApiScope[];
}

function validateKeyName(value: unknown) {
  if (typeof value !== "string") throw new PublicApiValidationError("A key name is required.");
  const trimmed = value.trim();
  if (trimmed.length < 2 || trimmed.length > 80) {
    throw new PublicApiValidationError("Key name must be between 2 and 80 characters.");
  }
  return trimmed;
}

function validateRateLimit(value: unknown) {
  if (value === undefined || value === null || value === "") return DEFAULT_RATE_LIMIT;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > MAX_RATE_LIMIT) {
    throw new PublicApiValidationError(`Rate limit must be an integer between 1 and ${MAX_RATE_LIMIT}.`);
  }
  return parsed;
}

function validateExpiration(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new PublicApiValidationError("expiresAt must be an ISO timestamp.");
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
    throw new PublicApiValidationError("expiresAt must be a future ISO timestamp.");
  }
  return date.toISOString();
}

function mapKey(row: PublicApiKeyRow): PublicApiKeyRecord {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    keyPrefix: row.key_prefix,
    keyLast4: row.key_last4,
    scopes: parseScopes(row.scopes_json),
    status: row.status,
    rateLimitPerMinute: Number(row.rate_limit_per_minute),
    expiresAt: row.expires_at,
    lastUsedAt: row.last_used_at,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
  };
}

function mapRequestLog(row: PublicApiRequestLogRow): PublicApiRequestLog {
  return {
    id: row.id,
    orgId: row.org_id,
    apiKeyId: row.api_key_id,
    route: row.route,
    method: row.method,
    statusCode: Number(row.status_code),
    latencyMs: Number(row.latency_ms),
    requestId: row.request_id,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  };
}

function safeCompare(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function findKeyByHash(secretHash: string): Promise<PublicApiKeyRow | null> {
  if (resolveDatabaseProvider() === "postgres") {
    const result = await queryPostgres<PublicApiKeyRow>(
      `SELECT * FROM public_api_keys WHERE secret_hash = $1 LIMIT 1`,
      [secretHash]
    );
    return result.rows[0] ?? null;
  }
  const db = getDatabase();
  return (db.prepare("SELECT * FROM public_api_keys WHERE secret_hash = ? LIMIT 1").get(secretHash) as PublicApiKeyRow | undefined) ?? null;
}

function rateLimitFor(key: PublicApiKeyRow): PublicApiRateLimitState {
  const limit = Number(key.rate_limit_per_minute);
  const now = Date.now();
  const current = rateLimitBuckets.get(key.id);
  const bucket = current && current.resetAtMs > now ? current : { count: 0, resetAtMs: now + 60_000 };
  bucket.count += 1;
  rateLimitBuckets.set(key.id, bucket);
  const remaining = Math.max(0, limit - bucket.count);
  const retryAfterSeconds = bucket.count > limit ? Math.ceil((bucket.resetAtMs - now) / 1000) : null;
  return {
    limit,
    remaining,
    resetAt: new Date(bucket.resetAtMs).toISOString(),
    retryAfterSeconds,
  };
}

export async function createPublicApiKey(input: CreateKeyInput) {
  const id = randomUUID();
  const now = nowIso();
  const name = validateKeyName(input.name);
  const scopes = validateScopes(input.scopes);
  const rateLimitPerMinute = validateRateLimit(input.rateLimitPerMinute);
  const expiresAt = validateExpiration(input.expiresAt);
  const secret = createSecret();
  const secretHash = hashSecret(secret);
  const keyLast4 = secret.slice(-4);
  const values = [
    id,
    input.orgId,
    name,
    KEY_PREFIX,
    keyLast4,
    secretHash,
    JSON.stringify(scopes),
    "active",
    rateLimitPerMinute,
    expiresAt,
    null,
    input.userId,
    now,
    null,
  ];

  if (resolveDatabaseProvider() === "postgres") {
    await queryPostgres(
      `INSERT INTO public_api_keys (
        id, org_id, name, key_prefix, key_last4, secret_hash, scopes_json, status,
        rate_limit_per_minute, expires_at, last_used_at, created_by_user_id, created_at, revoked_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      values
    );
  } else {
    getDatabase().prepare(
      `INSERT INTO public_api_keys (
        id, org_id, name, key_prefix, key_last4, secret_hash, scopes_json, status,
        rate_limit_per_minute, expires_at, last_used_at, created_by_user_id, created_at, revoked_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(...values);
  }

  return {
    key: {
      id,
      orgId: input.orgId,
      name,
      keyPrefix: KEY_PREFIX,
      keyLast4,
      scopes,
      status: "active" as const,
      rateLimitPerMinute,
      expiresAt,
      lastUsedAt: null,
      createdByUserId: input.userId,
      createdAt: now,
      revokedAt: null,
    },
    secret,
  };
}

export async function listPublicApiKeys(orgId: string): Promise<PublicApiKeyRecord[]> {
  if (resolveDatabaseProvider() === "postgres") {
    const result = await queryPostgres<PublicApiKeyRow>(
      `SELECT * FROM public_api_keys WHERE org_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [orgId]
    );
    return result.rows.map(mapKey);
  }
  return (getDatabase()
    .prepare("SELECT * FROM public_api_keys WHERE org_id = ? ORDER BY created_at DESC LIMIT 100")
    .all(orgId) as PublicApiKeyRow[]).map(mapKey);
}

export async function revokePublicApiKey(input: RevokeKeyInput) {
  const now = nowIso();
  if (resolveDatabaseProvider() === "postgres") {
    const result = await queryPostgres(
      `UPDATE public_api_keys
       SET status = 'revoked', revoked_at = $1
       WHERE id = $2 AND org_id = $3 AND status = 'active'`,
      [now, input.keyId, input.orgId]
    );
    return (result.rowCount ?? 0) > 0;
  }
  const result = getDatabase().prepare(
    `UPDATE public_api_keys
     SET status = 'revoked', revoked_at = ?
     WHERE id = ? AND org_id = ? AND status = 'active'`
  ).run(now, input.keyId, input.orgId);
  return result.changes > 0;
}

export async function listPublicApiRequestLogs(orgId: string): Promise<PublicApiRequestLog[]> {
  if (resolveDatabaseProvider() === "postgres") {
    const result = await queryPostgres<PublicApiRequestLogRow>(
      `SELECT * FROM public_api_request_logs WHERE org_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [orgId]
    );
    return result.rows.map(mapRequestLog);
  }
  return (getDatabase()
    .prepare("SELECT * FROM public_api_request_logs WHERE org_id = ? ORDER BY created_at DESC LIMIT 50")
    .all(orgId) as PublicApiRequestLogRow[]).map(mapRequestLog);
}

export async function recordPublicApiRequest(input: RecordRequestInput) {
  const values = [
    randomUUID(),
    input.orgId,
    input.apiKeyId,
    input.route,
    input.method.toUpperCase(),
    input.statusCode,
    input.latencyMs,
    input.requestId,
    input.errorMessage ?? null,
    nowIso(),
  ];
  if (resolveDatabaseProvider() === "postgres") {
    await queryPostgres(
      `INSERT INTO public_api_request_logs (
        id, org_id, api_key_id, route, method, status_code, latency_ms,
        request_id, error_message, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      values
    );
    await queryPostgres("UPDATE public_api_keys SET last_used_at = $1 WHERE id = $2", [values[9], input.apiKeyId]);
    return;
  }
  const db = getDatabase();
  db.prepare(
    `INSERT INTO public_api_request_logs (
      id, org_id, api_key_id, route, method, status_code, latency_ms,
      request_id, error_message, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(...values);
  db.prepare("UPDATE public_api_keys SET last_used_at = ? WHERE id = ?").run(values[9], input.apiKeyId);
}

export function applyPublicApiRateLimitHeaders(response: Response, state: PublicApiRateLimitState) {
  response.headers.set("X-RateLimit-Limit", String(state.limit));
  response.headers.set("X-RateLimit-Remaining", String(state.remaining));
  response.headers.set("X-RateLimit-Reset", state.resetAt);
  if (state.retryAfterSeconds !== null) {
    response.headers.set("Retry-After", String(state.retryAfterSeconds));
  }
}

export async function authenticatePublicApiRequest(request: Request, requiredScope: PublicApiScope): Promise<
  | { ok: true; principal: AuthenticatedPrincipal; rateLimit: PublicApiRateLimitState }
  | { ok: false; response: NextResponse; rateLimit?: PublicApiRateLimitState; principal?: AuthenticatedPrincipal }
> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) {
    return { ok: false, response: NextResponse.json({ error: "Bearer API key required." }, { status: 401 }) };
  }

  const suppliedSecret = match[1].trim();
  if (!suppliedSecret.startsWith(`${KEY_PREFIX}_`)) {
    return { ok: false, response: NextResponse.json({ error: "Invalid API key." }, { status: 401 }) };
  }

  const secretHash = hashSecret(suppliedSecret);
  const row = await findKeyByHash(secretHash);
  if (!row || !safeCompare(row.secret_hash, secretHash) || row.status !== "active") {
    return { ok: false, response: NextResponse.json({ error: "Invalid API key." }, { status: 401 }) };
  }

  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
    return { ok: false, response: NextResponse.json({ error: "API key expired." }, { status: 401 }) };
  }

  const scopes = parseScopes(row.scopes_json);
  const principal = { orgId: row.org_id, keyId: row.id, scopes };
  if (!scopes.includes(requiredScope)) {
    return { ok: false, principal, response: NextResponse.json({ error: "API key scope is not allowed for this endpoint." }, { status: 403 }) };
  }

  const rateLimit = rateLimitFor(row);
  if (rateLimit.retryAfterSeconds !== null) {
    return {
      ok: false,
      principal,
      rateLimit,
      response: NextResponse.json({ error: "Rate limit exceeded. Retry after the reset window." }, { status: 429 }),
    };
  }

  return { ok: true, principal, rateLimit };
}
