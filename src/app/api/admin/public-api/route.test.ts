import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ getAuthSession: vi.fn(), isDemoSession: vi.fn() }));
vi.mock("@/lib/audit", () => ({ recordAuditEvent: vi.fn() }));
vi.mock("@/lib/public-api", () => ({
  createPublicApiKey: vi.fn(), listPublicApiKeys: vi.fn(), listPublicApiRequestLogs: vi.fn(), revokePublicApiKey: vi.fn(),
  publicApiScopes: ["opportunities:read", "opportunities:graph:read"],
  PublicApiValidationError: class extends Error {},
}));

import { getAuthSession, isDemoSession, type AuthSession } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import { createPublicApiKey, listPublicApiKeys, listPublicApiRequestLogs, revokePublicApiKey } from "@/lib/public-api";
import { GET, POST, DELETE } from "@/app/api/admin/public-api/route";

const admin: AuthSession = { token: "session", userId: "user-1", orgId: "org-1", orgName: "Org", orgSlug: "org", email: "admin@test.local", name: "Admin", role: "admin", expiresAt: "2099-01-01T00:00:00.000Z" };
function request(payload: unknown, method = "POST", origin = "https://example.com") {
  return new Request("https://example.com/api/admin/public-api", { method, headers: { "content-type": "application/json", origin }, body: JSON.stringify(payload) });
}

describe("public API administration", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getAuthSession).mockResolvedValue(admin);
    vi.mocked(isDemoSession).mockReturnValue(false);
    vi.mocked(listPublicApiKeys).mockResolvedValue([]);
    vi.mocked(listPublicApiRequestLogs).mockResolvedValue([]);
  });

  it("requires authentication and rejects members and demo administrators", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    vi.mocked(getAuthSession).mockResolvedValue({ ...admin, role: "member" });
    expect((await POST(request({}))).status).toBe(403);
    vi.mocked(getAuthSession).mockResolvedValue(admin);
    vi.mocked(isDemoSession).mockReturnValue(true);
    expect((await GET()).status).toBe(403);
    expect((await POST(request({}))).status).toBe(403);
    expect((await DELETE(request({ keyId: "key" }, "DELETE"))).status).toBe(403);
    expect(createPublicApiKey).not.toHaveBeenCalled();
  });

  it("lists only the authenticated workspace and disables caching", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(listPublicApiKeys).toHaveBeenCalledWith("org-1");
    expect(listPublicApiRequestLogs).toHaveBeenCalledWith("org-1");
  });

  it("takes ownership from the session, returns the new secret once, and audits without it", async () => {
    const created = { key: { id: "key-1", scopes: ["opportunities:read"], rateLimitPerMinute: 20 }, secret: "bs_live_secret" };
    vi.mocked(createPublicApiKey).mockResolvedValue(created as Awaited<ReturnType<typeof createPublicApiKey>>);
    const response = await POST(request({ orgId: "victim", userId: "victim", name: "CRM", scopes: ["opportunities:read"], rateLimitPerMinute: 20 }));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(created);
    expect(createPublicApiKey).toHaveBeenCalledWith(expect.objectContaining({ orgId: "org-1", userId: "user-1" }));
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "public_api.key.create" }));
    expect(JSON.stringify(vi.mocked(recordAuditEvent).mock.calls)).not.toContain(created.secret);
  });

  it("rejects invalid bodies and cross-origin key creation", async () => {
    expect((await POST(request([]))).status).toBe(400);
    expect((await POST(request({}, "POST", "https://attacker.example"))).status).toBe(400);
    const malformed = new Request("https://example.com/api/admin/public-api", { method: "POST", headers: { "content-type": "application/json" }, body: "{" });
    expect((await POST(malformed)).status).toBe(400);
    expect(createPublicApiKey).not.toHaveBeenCalled();
  });

  it("cannot revoke a key belonging to another workspace", async () => {
    vi.mocked(revokePublicApiKey).mockResolvedValue(false);
    const response = await DELETE(request({ keyId: "other-org-key", orgId: "other-org" }, "DELETE"));
    expect(response.status).toBe(404);
    expect(revokePublicApiKey).toHaveBeenCalledWith({ orgId: "org-1", keyId: "other-org-key" });
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("records successful revocations", async () => {
    vi.mocked(revokePublicApiKey).mockResolvedValue(true);
    expect((await DELETE(request({ keyId: "key-1" }, "DELETE"))).status).toBe(200);
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "public_api.key.revoke", orgId: "org-1", resourceId: "key-1" }));
  });
});
