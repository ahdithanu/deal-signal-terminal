import { getDatabase } from "@/lib/db";

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

export function listPilotLeads(limit = 100) {
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
