import { NextResponse } from "next/server";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  name: string;
  max: number;
  windowMs: number;
};

type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitBucket>();

function cleanupExpiredBuckets(now: number) {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

function getClientIdentifier(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();

  return forwardedFor || realIp || "unknown-client";
}

export function checkRateLimit(request: Request, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  cleanupExpiredBuckets(now);

  const clientId = getClientIdentifier(request);
  const key = `${options.name}:${clientId}`;
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    const nextBucket: RateLimitBucket = {
      count: 1,
      resetAt: now + options.windowMs,
    };

    buckets.set(key, nextBucket);

    return {
      ok: true,
      limit: options.max,
      remaining: Math.max(0, options.max - 1),
      resetAt: nextBucket.resetAt,
    };
  }

  if (current.count >= options.max) {
    return {
      ok: false,
      limit: options.max,
      remaining: 0,
      resetAt: current.resetAt,
    };
  }

  current.count += 1;
  buckets.set(key, current);

  return {
    ok: true,
    limit: options.max,
    remaining: Math.max(0, options.max - current.count),
    resetAt: current.resetAt,
  };
}

export function applyRateLimitHeaders<T extends NextResponse>(
  response: T,
  rateLimit: RateLimitResult
): T {
  response.headers.set("X-RateLimit-Limit", String(rateLimit.limit));
  response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
  response.headers.set("X-RateLimit-Reset", String(Math.ceil(rateLimit.resetAt / 1000)));
  return response;
}

export function buildRateLimitResponse(rateLimit: RateLimitResult, message: string) {
  const response = NextResponse.json({ error: message }, { status: 429 });
  response.headers.set("Retry-After", String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))));
  return applyRateLimitHeaders(response, rateLimit);
}
