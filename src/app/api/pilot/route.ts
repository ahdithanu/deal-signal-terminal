import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { getDatabase } from "@/lib/db";
import { logInfo, logWarn } from "@/lib/observability";

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
  const payload = (await request.json()) as PilotLeadPayload;

  const name = cleanOptionalString(payload.name);
  const email = cleanOptionalString(payload.email)?.toLowerCase();
  const company = cleanOptionalString(payload.company);
  const role = cleanOptionalString(payload.role);
  const marketFocus = cleanOptionalString(payload.marketFocus);
  const teamSize = cleanOptionalString(payload.teamSize);
  const notes = cleanOptionalString(payload.notes);

  if (!name || !email || !company || !notes) {
    return NextResponse.json(
      { error: "Name, work email, company, and pilot goals are required." },
      { status: 400 }
    );
  }

  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (!looksLikeEmail) {
    return NextResponse.json({ error: "Enter a valid work email." }, { status: 400 });
  }

  if (notes.length < 20) {
    return NextResponse.json(
      { error: "Tell us a bit more about the workflow or market you want to test." },
      { status: 400 }
    );
  }

  const db = getDatabase();
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO pilot_leads (
      id,
      created_at,
      name,
      email,
      company,
      role,
      market_focus,
      team_size,
      notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, createdAt, name, email, company, role, marketFocus, teamSize, notes);

  logInfo("Pilot lead captured", {
    company,
    email,
    marketFocus,
    role,
    teamSize,
  });

  return NextResponse.json({
    ok: true,
    lead: {
      id,
      createdAt,
    },
  });
}
