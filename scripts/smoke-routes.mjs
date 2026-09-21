const baseUrl = process.env.SMOKE_BASE_URL?.trim() || "http://localhost:3000";
const smokeEmail =
  process.env.SMOKE_EMAIL?.trim() ||
  process.env.BUILD_SIGNALS_BOOTSTRAP_EMAIL?.trim() ||
  "admin@buildsignals.local";
const smokePassword =
  process.env.SMOKE_PASSWORD?.trim() ||
  process.env.BUILD_SIGNALS_BOOTSTRAP_PASSWORD?.trim() ||
  "change-me-now";
const demoSlug = process.env.SMOKE_OPPORTUNITY_SLUG?.trim() || "air-park-self-storage-fire";

function normalizeExpectedStatus(expectedStatus) {
  return Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
}

async function checkRoute(route, init = {}) {
  const response = await fetch(`${baseUrl}${route.path}`, {
    redirect: "manual",
    ...init,
  });

  const allowedStatuses = normalizeExpectedStatus(route.expectedStatus);

  if (!allowedStatuses.includes(response.status)) {
    throw new Error(
      `Expected ${route.path} to return ${allowedStatuses.join(" or ")}, received ${response.status}`
    );
  }

  return `${route.path} -> ${response.status}`;
}

async function authenticate() {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: smokeEmail,
      password: smokePassword,
    }),
  });

  if (response.status !== 200) {
    const body = await response.text();
    throw new Error(`Login failed with ${response.status}: ${body}`);
  }

  const cookieHeader = response.headers.get("set-cookie");

  if (!cookieHeader) {
    throw new Error("Login succeeded but no session cookie was returned.");
  }

  return cookieHeader.split(";")[0];
}

async function main() {
  const unauthenticatedRoutes = [
    { path: "/login", expectedStatus: 200 },
    { path: "/api/health", expectedStatus: 200 },
    { path: "/", expectedStatus: [302, 307] },
  ];
  const results = [];

  for (const route of unauthenticatedRoutes) {
    results.push(await checkRoute(route));
  }

  const sessionCookie = await authenticate();
  results.push("POST /api/auth/login -> 200");

  const authenticatedRoutes = [
    { path: "/login", expectedStatus: [302, 307] },
    { path: "/", expectedStatus: 200 },
    { path: "/watchlist", expectedStatus: 200 },
    { path: `/opportunity/${demoSlug}`, expectedStatus: 200 },
    { path: `/memo/${demoSlug}`, expectedStatus: 200 },
    { path: "/opportunity/not-a-real-slug", expectedStatus: 404 },
    { path: "/api/admin/audit", expectedStatus: 200 },
  ];

  for (const route of authenticatedRoutes) {
    results.push(
      await checkRoute(route, {
        headers: {
          Cookie: sessionCookie,
        },
      })
    );
  }

  for (const line of results) {
    console.log(line);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
