import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

import { AUTH_SESSION_COOKIE } from "@/lib/auth-shared";
import { closeDatabase, getDatabase, resetDatabaseForTests } from "@/lib/db";

type AuthRole = "admin" | "member";

type OrganizationRecord = {
  id: string;
  name: string;
  slug: string;
};

type UserRecord = {
  id: string;
  orgId: string;
  email: string;
  name: string;
  role: AuthRole;
  passwordHash: string;
  passwordSalt: string;
};

type SessionRecord = {
  token: string;
  userId: string;
  orgId: string;
  expiresAt: string;
};

export type AuthSession = {
  token: string;
  userId: string;
  orgId: string;
  orgName: string;
  orgSlug: string;
  email: string;
  name: string;
  role: AuthRole;
  expiresAt: string;
};

export type DemoWorkspaceCredentials = {
  email: string;
  password: string;
  orgName: string;
};

function getBootstrapConfig() {
  const email =
    process.env.BUILD_SIGNALS_BOOTSTRAP_EMAIL?.trim() ||
    process.env.DST_BOOTSTRAP_EMAIL?.trim() ||
    "admin@buildsignals.local";
  const password =
    process.env.BUILD_SIGNALS_BOOTSTRAP_PASSWORD?.trim() ||
    process.env.DST_BOOTSTRAP_PASSWORD?.trim() ||
    "change-me-now";
  const orgName =
    process.env.BUILD_SIGNALS_BOOTSTRAP_ORG_NAME?.trim() ||
    process.env.DST_BOOTSTRAP_ORG_NAME?.trim() ||
    "Build Signals";
  const orgSlug =
    process.env.BUILD_SIGNALS_BOOTSTRAP_ORG_SLUG?.trim() ||
    process.env.DST_BOOTSTRAP_ORG_SLUG?.trim() ||
    "build-signals";

  return {
    email,
    password,
    orgName,
    orgSlug,
  };
}

function shouldExposeDemoCredentials() {
  return (
    process.env.BUILD_SIGNALS_EXPOSE_DEMO_CREDENTIALS === "true" ||
    process.env.DST_EXPOSE_DEMO_CREDENTIALS === "true" ||
    process.env.NODE_ENV !== "production"
  );
}

export function getDemoWorkspaceCredentials(): DemoWorkspaceCredentials | null {
  const bootstrap = getBootstrapConfig();

  if (!shouldExposeDemoCredentials() || !bootstrap.email || !bootstrap.password) {
    return null;
  }

  return {
    email: bootstrap.email,
    password: bootstrap.password,
    orgName: bootstrap.orgName,
  };
}

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString("hex");
}

function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashPassword(password, salt), "hex");
  const expected = Buffer.from(expectedHash, "hex");

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}

async function ensureBootstrapUser() {
  const db = getDatabase();
  const existingUser = db.prepare("SELECT id FROM users LIMIT 1").get() as { id: string } | undefined;

  if (existingUser) {
    return;
  }

  const bootstrap = getBootstrapConfig();

  if (!bootstrap.email || !bootstrap.password) {
    return;
  }

  const salt = randomBytes(16).toString("hex");
  const orgId = randomUUID();
  const userId = randomUUID();

  db.prepare(
    "INSERT INTO organizations (id, name, slug) VALUES (?, ?, ?)"
  ).run(orgId, bootstrap.orgName, bootstrap.orgSlug);
  db.prepare(
    "INSERT INTO users (id, org_id, email, name, role, password_hash, password_salt) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(
    userId,
    orgId,
    bootstrap.email.toLowerCase(),
    "Platform Admin",
    "admin",
    hashPassword(bootstrap.password, salt),
    salt
  );
}

function buildSession(
  user: Pick<UserRecord, "id" | "email" | "name" | "role">,
  org: OrganizationRecord,
  sessionRecord: SessionRecord
): AuthSession {
  return {
    token: sessionRecord.token,
    userId: user.id,
    orgId: org.id,
    orgName: org.name,
    orgSlug: org.slug,
    email: user.email,
    name: user.name,
    role: user.role,
    expiresAt: sessionRecord.expiresAt,
  };
}

type SessionJoinRecord = {
  token: string;
  user_id: string;
  org_id: string;
  expires_at: string;
  email: string;
  name: string;
  role: AuthRole;
  org_name: string;
  org_slug: string;
};

function rowToSession(record: SessionJoinRecord): AuthSession {
  return buildSession(
    {
      id: record.user_id,
      email: record.email,
      name: record.name,
      role: record.role,
    },
    {
      id: record.org_id,
      name: record.org_name,
      slug: record.org_slug,
    },
    {
      token: record.token,
      userId: record.user_id,
      orgId: record.org_id,
      expiresAt: record.expires_at,
    }
  );
}

export function userStateKeyForSession(session: Pick<AuthSession, "orgId" | "userId">): string {
  return `${session.orgId}:${session.userId}`;
}

export async function loginWithPassword(email: string, password: string): Promise<AuthSession | null> {
  await ensureBootstrapUser();
  const db = getDatabase();

  const normalizedEmail = email.trim().toLowerCase();
  const user = db.prepare(
    "SELECT id, org_id, email, name, role, password_hash, password_salt FROM users WHERE email = ?"
  ).get(normalizedEmail) as
    | {
        id: string;
        org_id: string;
        email: string;
        name: string;
        role: AuthRole;
        password_hash: string;
        password_salt: string;
      }
    | undefined;

  if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
    return null;
  }

  const sessionRecord: SessionRecord = {
    token: randomUUID(),
    userId: user.id,
    orgId: user.org_id,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
  };

  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
  db.prepare("INSERT INTO sessions (token, user_id, org_id, expires_at) VALUES (?, ?, ?, ?)").run(
    sessionRecord.token,
    sessionRecord.userId,
    sessionRecord.orgId,
    sessionRecord.expiresAt
  );

  const org = db.prepare("SELECT id, name, slug FROM organizations WHERE id = ?").get(user.org_id) as
    | OrganizationRecord
    | undefined;

  if (!org) {
    return null;
  }

  return buildSession(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    org,
    sessionRecord
  );
}

export async function loginWithDemoWorkspace(): Promise<AuthSession | null> {
  const bootstrap = getBootstrapConfig();

  if (!bootstrap.email || !bootstrap.password) {
    return null;
  }

  return loginWithPassword(bootstrap.email, bootstrap.password);
}

export async function getAuthSessionByToken(token: string | undefined): Promise<AuthSession | null> {
  if (!token) {
    return null;
  }

  await ensureBootstrapUser();
  const db = getDatabase();
  const sessionRecord = db
    .prepare(
      `SELECT
        sessions.token,
        sessions.user_id,
        sessions.org_id,
        sessions.expires_at,
        users.email,
        users.name,
        users.role,
        organizations.name AS org_name,
        organizations.slug AS org_slug
      FROM sessions
      INNER JOIN users ON users.id = sessions.user_id
      INNER JOIN organizations ON organizations.id = sessions.org_id
      WHERE sessions.token = ?`
    )
    .get(token) as SessionJoinRecord | undefined;

  if (!sessionRecord) {
    return null;
  }

  if (new Date(sessionRecord.expires_at).getTime() <= Date.now()) {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    return null;
  }

  return rowToSession(sessionRecord);
}

export async function getAuthSession(): Promise<AuthSession | null> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_SESSION_COOKIE)?.value;

  return getAuthSessionByToken(token);
}

export async function clearAuthSession(token: string | undefined) {
  if (!token) {
    return;
  }

  const db = getDatabase();
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export const __testing = {
  ensureBootstrapUser,
  resetStorage() {
    resetDatabaseForTests();
    closeDatabase();
  },
};
