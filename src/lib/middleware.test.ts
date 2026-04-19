import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { AUTH_SESSION_COOKIE } from "@/lib/auth-shared";
import { middleware } from "../../middleware";

function makeRequest(pathname: string, sessionToken?: string) {
  const headers = new Headers();

  if (sessionToken) {
    headers.set("cookie", `${AUTH_SESSION_COOKIE}=${sessionToken}`);
  }

  return new NextRequest(`https://example.com${pathname}`, { headers });
}

describe("middleware", () => {
  it("redirects unauthenticated app requests to login", () => {
    const response = middleware(makeRequest("/"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://example.com/login");
  });

  it("allows public health checks without authentication", () => {
    const response = middleware(makeRequest("/api/health"));

    expect(response.status).toBe(200);
  });

  it("returns a 401 JSON response for protected API requests without a session", async () => {
    const response = middleware(makeRequest("/api/admin/audit"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Authentication required." });
  });

  it("redirects authenticated users away from the login page", () => {
    const response = middleware(makeRequest("/login", "session-token"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://example.com/");
  });
});
