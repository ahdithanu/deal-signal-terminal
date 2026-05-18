import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { logInfo, redactEmail } from "@/lib/observability";
import { createPilotLead } from "@/lib/pilot-leads";
import { applyRateLimitHeaders, buildRateLimitResponse, checkRateLimit } from "@/lib/rate-limit";
import { applySecurityHeaders } from "@/lib/security";

type PilotLeadPayload = {
  name?: unknown;
  email?: unknown;
  company?: unknown;
  role?: unknown;
  marketFocus?: unknown;
  teamSize?: unknown;
  notes?: unknown;
};

function cleanOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(request, {
    name: "pilot-intake",
    max: 5,
    windowMs: 60_000 * 10,
  });

  if (!rateLimit.ok) {
    return applySecurityHeaders(
      buildRateLimitResponse(rateLimit, "Too many pilot requests. Please try again later.")
    );
  }

  const payload = (await request.json()) as PilotLeadPayload;

  const name = cleanOptionalString(payload.name);
  const email = cleanOptionalString(payload.email)?.toLowerCase();
  const company = cleanOptionalString(payload.company);
  const role = cleanOptionalString(payload.role);
  const marketFocus = cleanOptionalString(payload.marketFocus);
  const teamSize = cleanOptionalString(payload.teamSize);
  const notes = cleanOptionalString(payload.notes);

  if (!name || !email || !company || !notes) {
    return applySecurityHeaders(
      applyRateLimitHeaders(
        NextResponse.json(
          { error: "Name, work email, company, and pilot goals are required." },
          { status: 400 }
        ),
        rateLimit
      )
    );
  }

  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (!looksLikeEmail) {
    return applySecurityHeaders(
      applyRateLimitHeaders(
        NextResponse.json({ error: "Enter a valid work email." }, { status: 400 }),
        rateLimit
      )
    );
  }

  if (notes.length < 20) {
    return applySecurityHeaders(
      applyRateLimitHeaders(
        NextResponse.json(
          { error: "Tell us a bit more about the workflow or market you want to test." },
          { status: 400 }
        ),
        rateLimit
      )
    );
  }

  const id = randomUUID();
  const createdAt = new Date().toISOString();

  await createPilotLead({
    id,
    createdAt,
    name,
    email,
    company,
    role,
    marketFocus,
    teamSize,
    notes,
  });

  logInfo("Pilot lead captured", {
    company,
    email: redactEmail(email),
    marketFocus,
    role,
    teamSize,
  });

  return applySecurityHeaders(
    applyRateLimitHeaders(
      NextResponse.json({
        ok: true,
        lead: {
          id,
          createdAt,
        },
      }),
      rateLimit
    )
  );
}
