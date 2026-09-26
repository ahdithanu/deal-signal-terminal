export const publicApiScopes = ["opportunities:read", "opportunities:graph:read"] as const;

export type PublicApiScope = (typeof publicApiScopes)[number];

export type PublicApiKeyStatus = "active" | "revoked";

export type PublicApiKeyRecord = {
  id: string;
  orgId: string;
  name: string;
  keyPrefix: string;
  keyLast4: string;
  scopes: PublicApiScope[];
  status: PublicApiKeyStatus;
  rateLimitPerMinute: number;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdByUserId: string | null;
  createdAt: string;
  revokedAt: string | null;
};

export type PublicApiRequestLog = {
  id: string;
  orgId: string | null;
  apiKeyId: string | null;
  route: string;
  method: string;
  statusCode: number;
  latencyMs: number;
  requestId: string;
  errorMessage: string | null;
  createdAt: string;
};

export type PublicApiRateLimitState = {
  limit: number;
  remaining: number;
  resetAt: string;
  retryAfterSeconds: number | null;
};
