import { Pool, type PoolClient, type QueryResultRow } from "pg";

import { buildSchemaSql } from "@/lib/db-schema";

let pool: Pool | null = null;
let schemaReadyPromise: Promise<void> | null = null;

function getDatabaseUrl(): string {
  const url = process.env.BUILD_SIGNALS_DATABASE_URL?.trim();

  if (!url) {
    throw new Error("BUILD_SIGNALS_DATABASE_URL must be set when BUILD_SIGNALS_DB_PROVIDER=postgres.");
  }

  return url;
}

export function getPostgresPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
      max: 10,
      ssl:
        process.env.BUILD_SIGNALS_DATABASE_SSL === "false"
          ? false
          : process.env.NODE_ENV === "production"
            ? { rejectUnauthorized: false }
            : undefined,
    });
  }

  return pool;
}

export async function ensurePostgresSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await getPostgresPool().query(buildSchemaSql("postgres"));
    })();
  }

  return schemaReadyPromise;
}

export async function queryPostgres<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[]
) {
  await ensurePostgresSchema();
  return getPostgresPool().query<T>(text, values);
}

export async function withPostgresClient<T>(fn: (client: PoolClient) => Promise<T>) {
  await ensurePostgresSchema();
  const client = await getPostgresPool().connect();

  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function closePostgresPool() {
  if (pool) {
    await pool.end();
    pool = null;
    schemaReadyPromise = null;
  }
}
