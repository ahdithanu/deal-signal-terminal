import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/opportunity-service", () => ({
  getOpportunities: vi.fn(),
  getOpportunityBySlugWithGenerated: vi.fn(),
}));
vi.mock("@/lib/opportunity-graph", () => ({ buildOpportunityGraphContext: vi.fn() }));

import { __testing, loginWithPassword, type AuthSession } from "@/lib/auth";
import { opportunities } from "@/lib/opportunities";
import { getOpportunities, getOpportunityBySlugWithGenerated } from "@/lib/opportunity-service";
import { buildOpportunityGraphContext } from "@/lib/opportunity-graph";
import { createPublicApiKey, listPublicApiRequestLogs, revokePublicApiKey } from "@/lib/public-api";
import { GET } from "@/app/api/v1/opportunities/route";
import { GET as detail } from "@/app/api/v1/opportunities/[slug]/route";
import { GET as graph } from "@/app/api/v1/opportunities/[slug]/graph/route";

let session: AuthSession;
let secret: string;
let keyId: string;
function request(query = "", key: string | null = secret) {
  return new Request(`https://example.com/api/v1/opportunities${query}`, {
    headers: key ? { Authorization: `Bearer ${key}` } : undefined,
  });
}

describe("public opportunity API", () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    vi.stubEnv("BUILD_SIGNALS_DB_PATH", `${process.cwd()}/.data/test-public-api-routes.db`);
    vi.stubEnv("BUILD_SIGNALS_DB_PROVIDER", "sqlite");
    vi.stubEnv("BUILD_SIGNALS_BOOTSTRAP_EMAIL", "api-routes@test.local");
    vi.stubEnv("BUILD_SIGNALS_BOOTSTRAP_PASSWORD", "test-password");
    __testing.resetStorage();
    session = (await loginWithPassword("api-routes@test.local", "test-password"))!;
    const created = await createPublicApiKey({ orgId: session.orgId, userId: session.userId, name: "Route tests", scopes: ["opportunities:read"] });
    secret = created.secret;
    keyId = created.key.id;
    vi.mocked(getOpportunities).mockResolvedValue(opportunities);
    vi.mocked(getOpportunityBySlugWithGenerated).mockResolvedValue(opportunities[0]);
  });

  afterEach(() => { __testing.resetStorage(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it("rejects missing and revoked keys before retrieving opportunities", async () => {
    expect((await GET(request("", null))).status).toBe(401);
    await revokePublicApiKey({ orgId: session.orgId, keyId });
    expect((await GET(request())).status).toBe(401);
    expect(getOpportunities).not.toHaveBeenCalled();
  });

  it("paginates without duplicates and records safe workspace usage", async () => {
    const first = await GET(request("?limit=2"));
    const body = await first.json();
    expect(first.status).toBe(200);
    expect(first.headers.get("cache-control")).toBe("no-store");
    expect(first.headers.get("x-request-id")).toBeTruthy();
    expect(first.headers.get("x-ratelimit-limit")).toBeTruthy();
    expect(body.data).toHaveLength(2);
    const second = await (await GET(request(`?limit=2&cursor=${body.pagination.nextCursor}`))).json();
    expect(second.data.map((item: { id: string }) => item.id).some((id: string) => body.data.some((item: { id: string }) => item.id === id))).toBe(false);
    const logs = await listPublicApiRequestLogs(session.orgId);
    expect(logs).toHaveLength(2);
    expect(logs[0].route).toBe("/api/v1/opportunities");
    expect(JSON.stringify(logs)).not.toContain(secret);
  });

  it.each(["limit=NaN", "limit=101", "cursor=-1", "cursor=1.5", "minScore=101", "opportunityType=invalid"])("rejects malformed query %s", async (query) => {
    expect((await GET(request(`?${query}`))).status).toBe(400);
  });

  it("applies combined filters to the public catalog", async () => {
    const target = opportunities[0];
    const response = await GET(request(`?marketId=${target.marketId}&opportunityType=${target.opportunityType}&minScore=${target.priorityScore}`));
    const body = await response.json();
    expect(body.data.length).toBeGreaterThan(0);
    for (const item of body.data) {
      expect(item.marketId).toBe(target.marketId);
      expect(item.opportunityType).toBe(target.opportunityType);
      expect(item.priorityScore).toBeGreaterThanOrEqual(target.priorityScore);
    }
  });

  it("returns evidence in detail and a JSON 404 for unknown opportunities", async () => {
    const response = await detail(request(), { params: Promise.resolve({ slug: opportunities[0].slug }) });
    const body = await response.json();
    expect(body.data.evidence).toEqual(opportunities[0].evidence);
    expect(body.data.scoreBreakdown).toEqual(opportunities[0].scoreBreakdown);
    vi.mocked(getOpportunityBySlugWithGenerated).mockResolvedValue(undefined);
    expect((await detail(request(), { params: Promise.resolve({ slug: "unknown" }) })).status).toBe(404);
  });

  it("requires the separate graph scope before building graph context", async () => {
    expect((await graph(request(), { params: Promise.resolve({ slug: opportunities[0].slug }) })).status).toBe(403);
    expect(buildOpportunityGraphContext).not.toHaveBeenCalled();
    const graphKey = await createPublicApiKey({ orgId: session.orgId, userId: session.userId, name: "Graph tests", scopes: ["opportunities:graph:read"] });
    vi.mocked(buildOpportunityGraphContext).mockResolvedValue({
      opportunityEntity: { id: "entity-1" },
      entities: [{ id: "entity-1", entityType: "opportunity", displayName: "Project", properties: { secret: "private-note" } }],
      relationships: [], related: [],
    } as unknown as Awaited<ReturnType<typeof buildOpportunityGraphContext>>);
    const response = await graph(request("", graphKey.secret), { params: Promise.resolve({ slug: opportunities[0].slug }) });
    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain("private-note");
  });

  it("sanitizes service failures and keeps request correlation", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getOpportunities).mockRejectedValue(new Error(`database credentials: ${secret}`));
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain(secret);
    expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect((await listPublicApiRequestLogs(session.orgId))[0].statusCode).toBe(503);
  });

  it("enforces rate limits even when a request handler fails", async () => {
    const limited = await createPublicApiKey({ orgId: session.orgId, userId: session.userId, name: "Limited", scopes: ["opportunities:read"], rateLimitPerMinute: 1 });
    expect((await GET(request("?limit=invalid", limited.secret))).status).toBe(400);
    const blocked = await GET(request("", limited.secret));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
  });
});
