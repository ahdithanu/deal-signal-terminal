import { getDatabase, resolveDatabaseProvider } from "@/lib/db";
import { queryPostgres } from "@/lib/postgres";

export type PilotLeadRecord = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  company: string;
  role: string | null;
  market_focus: string | null;
  team_size: string | null;
  notes: string;
};

export type CreatePilotLeadInput = {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  company: string;
  role: string | null;
  marketFocus: string | null;
  teamSize: string | null;
  notes: string;
};

export async function createPilotLead(input: CreatePilotLeadInput) {
  if (resolveDatabaseProvider() === "postgres") {
    await queryPostgres(
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
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        input.id,
        input.createdAt,
        input.name,
        input.email,
        input.company,
        input.role,
        input.marketFocus,
        input.teamSize,
        input.notes,
      ]
    );
    return;
  }

  const db = getDatabase();
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
  ).run(
    input.id,
    input.createdAt,
    input.name,
    input.email,
    input.company,
    input.role,
    input.marketFocus,
    input.teamSize,
    input.notes
  );
}

export async function listPilotLeads(limit = 100) {
  if (resolveDatabaseProvider() === "postgres") {
    const result = await queryPostgres<PilotLeadRecord>(
      `SELECT
        id,
        created_at,
        name,
        email,
        company,
        role,
        market_focus,
        team_size,
        notes
      FROM pilot_leads
      ORDER BY created_at DESC
      LIMIT $1`,
      [limit]
    );

    return result.rows;
  }

  const db = getDatabase();

  return db
    .prepare(
      `SELECT
        id,
        created_at,
        name,
        email,
        company,
        role,
        market_focus,
        team_size,
        notes
      FROM pilot_leads
      ORDER BY created_at DESC
      LIMIT ?`
    )
    .all(limit) as PilotLeadRecord[];
}
