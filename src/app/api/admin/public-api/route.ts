import { NextResponse } from "next/server";

import { recordAuditEvent } from "@/lib/audit";
import { getAuthSession, isDemoSession } from "@/lib/auth";
import { logError } from "@/lib/observability";
import {
  createPublicApiKey,
  listPublicApiKeys,
  listPublicApiRequestLogs,
  publicApiScopes,
  PublicApiValidationError,
  revokePublicApiKey,
} from "@/lib/public-api";
import { applySecurityHeaders } from "@/lib/security";

export const runtime = "nodejs";

function json(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return applySecurityHeaders(response);
}

async function requireAdmin() {
  const session = await getAuthSession();
  if (!session) return { response: json({ error: "Authentication required." }, 401) };
  if (session.role !== "admin" || isDemoSession(session)) {
    return { response: json({ error: "Sign in with a workspace admin account to manage API keys." }, 403) };
  }
  return { session };
}

async function readPayload(request: Request): Promise<Record<string, unknown>> {
  const origin = request.headers.get("origin");
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new PublicApiValidationError("Cross-origin key management is not allowed.");
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new PublicApiValidationError("A JSON request body is required.");
  }
  const text = await request.text();
  if (text.length > 8192) throw new PublicApiValidationError("Request body is too large.");
  let payload: unknown;
  try { payload = JSON.parse(text); } catch { throw new PublicApiValidationError("Invalid JSON request."); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new PublicApiValidationError("Expected a JSON object.");
  }
  return payload as Record<string, unknown>;
}

function failure(error: unknown) {
  if (error instanceof PublicApiValidationError) return json({ error: error.message }, 400);
  logError("API key management failed");
  return json({ error: "API key management is temporarily unavailable." }, 503);
}

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;
    const keys = await listPublicApiKeys(auth.session.orgId);
    const requestLogs = await listPublicApiRequestLogs(auth.session.orgId);
    return json({ keys, requestLogs, scopes: publicApiScopes });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;
    const payload = await readPayload(request);
    const created = await createPublicApiKey({
      orgId: auth.session.orgId,
      userId: auth.session.userId,
      name: payload.name,
      scopes: payload.scopes,
      rateLimitPerMinute: payload.rateLimitPerMinute,
      expiresAt: payload.expiresAt,
    });
    try {
      await recordAuditEvent({
        orgId: auth.session.orgId,
        userId: auth.session.userId,
        action: "public_api.key.create",
        resourceType: "public_api_key",
        resourceId: created.key.id,
        metadata: { scopes: created.key.scopes, rateLimitPerMinute: created.key.rateLimitPerMinute },
      });
    } catch {
      await revokePublicApiKey({ orgId: auth.session.orgId, keyId: created.key.id });
      throw new Error("Could not record key creation.");
    }
    return json(created, 201);
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;
    const payload = await readPayload(request);
    if (typeof payload.keyId !== "string" || !payload.keyId.trim() || payload.keyId.length > 100) {
      throw new PublicApiValidationError("A valid keyId is required.");
    }
    const revoked = await revokePublicApiKey({ orgId: auth.session.orgId, keyId: payload.keyId });
    if (!revoked) return json({ error: "API key not found." }, 404);
    await recordAuditEvent({
      orgId: auth.session.orgId,
      userId: auth.session.userId,
      action: "public_api.key.revoke",
      resourceType: "public_api_key",
      resourceId: payload.keyId,
    });
    return json({ ok: true });
  } catch (error) { return failure(error); }
}
