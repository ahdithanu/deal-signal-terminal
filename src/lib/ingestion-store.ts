import { randomUUID } from "node:crypto";

import { getDatabase, resolveDatabaseProvider } from "@/lib/db";
import { queryPostgres } from "@/lib/postgres";

export type SourceDocumentInput = {
  id?: string;
  marketId: string;
  sourceName: string;
  sourceUrl: string;
  documentUrl: string;
  reportLabel: string;
  reportingPeriodStart?: string | null;
  reportingPeriodEnd?: string | null;
  publishedAt?: string | null;
  accessedAt: string;
  checksum?: string | null;
  metadata?: Record<string, unknown>;
};

export type PermitRecordInput = {
  id?: string;
  sourceDocumentId: string;
  marketId: string;
  jurisdiction: string;
  permitNumber: string;
  permitType: string;
  permitSubtype?: string | null;
  status?: string | null;
  appliedDate?: string | null;
  issuedDate?: string | null;
  finaledDate?: string | null;
  address?: string | null;
  city?: string | null;
  parcelNumber?: string | null;
  applicant?: string | null;
  contractor?: string | null;
  valuation?: number | null;
  description: string;
  raw: Record<string, unknown>;
  contentHash: string;
};

export type IngestionRunInput = {
  id?: string;
  sourceDocumentId?: string | null;
  marketId: string;
  status?: "running" | "succeeded" | "failed";
  startedAt?: string;
  metadata?: Record<string, unknown>;
};

export type FinishIngestionRunInput = {
  id: string;
  status: "succeeded" | "failed";
  finishedAt?: string;
  recordsFound: number;
  recordsInserted: number;
  recordsUpdated: number;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
};

export type DataHealthMarket = {
  market_id: string;
  source_documents: number;
  permit_records: number;
  latest_accessed_at: string | null;
  latest_run_started_at: string | null;
  latest_run_finished_at: string | null;
  latest_run_status: string | null;
  latest_run_records_found: number | null;
  latest_run_records_inserted: number | null;
  latest_run_records_updated: number | null;
  latest_run_error_message: string | null;
};

export type UpsertPermitRecordResult = {
  id: string;
  action: "inserted" | "updated";
};

export type StoredPermitRecord = {
  id: string;
  source_document_id: string;
  market_id: string;
  jurisdiction: string;
  permit_number: string;
  permit_type: string;
  permit_subtype: string | null;
  status: string | null;
  applied_date: string | null;
  issued_date: string | null;
  finaled_date: string | null;
  address: string | null;
  city: string | null;
  parcel_number: string | null;
  applicant: string | null;
  contractor: string | null;
  valuation: number | null;
  description: string;
  raw_json: string | null;
  content_hash: string;
  created_at: string;
  updated_at: string;
  source_name: string;
  source_url: string;
  document_url: string;
  report_label: string;
  published_at: string | null;
  accessed_at: string;
};

async function findPermitRecordId(marketId: string, permitNumber: string) {
  if (resolveDatabaseProvider() === "postgres") {
    const result = await queryPostgres<{ id: string }>(
      "SELECT id FROM permit_records WHERE market_id = $1 AND permit_number = $2",
      [marketId, permitNumber]
    );

    return result.rows[0]?.id ?? null;
  }

  const db = getDatabase();
  const row = db
    .prepare("SELECT id FROM permit_records WHERE market_id = ? AND permit_number = ?")
    .get(marketId, permitNumber) as { id: string } | undefined;

  return row?.id ?? null;
}

export async function upsertSourceDocument(input: SourceDocumentInput) {
  const id = input.id ?? randomUUID();
  const now = new Date().toISOString();
  const values = [
    id,
    input.marketId,
    input.sourceName,
    input.sourceUrl,
    input.documentUrl,
    input.reportLabel,
    input.reportingPeriodStart ?? null,
    input.reportingPeriodEnd ?? null,
    input.publishedAt ?? null,
    input.accessedAt,
    input.checksum ?? null,
    JSON.stringify(input.metadata ?? {}),
    now,
    now,
  ];

  if (resolveDatabaseProvider() === "postgres") {
    await queryPostgres(
      `INSERT INTO source_documents (
        id,
        market_id,
        source_name,
        source_url,
        document_url,
        report_label,
        reporting_period_start,
        reporting_period_end,
        published_at,
        accessed_at,
        checksum,
        metadata_json,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO UPDATE SET
        market_id = EXCLUDED.market_id,
        source_name = EXCLUDED.source_name,
        source_url = EXCLUDED.source_url,
        document_url = EXCLUDED.document_url,
        report_label = EXCLUDED.report_label,
        reporting_period_start = EXCLUDED.reporting_period_start,
        reporting_period_end = EXCLUDED.reporting_period_end,
        published_at = EXCLUDED.published_at,
        accessed_at = EXCLUDED.accessed_at,
        checksum = EXCLUDED.checksum,
        metadata_json = EXCLUDED.metadata_json,
        updated_at = EXCLUDED.updated_at`,
      values
    );
    return id;
  }

  const db = getDatabase();
  db.prepare(
    `INSERT INTO source_documents (
      id,
      market_id,
      source_name,
      source_url,
      document_url,
      report_label,
      reporting_period_start,
      reporting_period_end,
      published_at,
      accessed_at,
      checksum,
      metadata_json,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      market_id = excluded.market_id,
      source_name = excluded.source_name,
      source_url = excluded.source_url,
      document_url = excluded.document_url,
      report_label = excluded.report_label,
      reporting_period_start = excluded.reporting_period_start,
      reporting_period_end = excluded.reporting_period_end,
      published_at = excluded.published_at,
      accessed_at = excluded.accessed_at,
      checksum = excluded.checksum,
      metadata_json = excluded.metadata_json,
      updated_at = excluded.updated_at`
  ).run(...values);

  return id;
}

export async function upsertPermitRecord(
  input: PermitRecordInput
): Promise<UpsertPermitRecordResult> {
  const existingId = await findPermitRecordId(input.marketId, input.permitNumber);
  const id = existingId ?? input.id ?? randomUUID();
  const action = existingId ? "updated" : "inserted";
  const now = new Date().toISOString();
  const values = [
    id,
    input.sourceDocumentId,
    input.marketId,
    input.jurisdiction,
    input.permitNumber,
    input.permitType,
    input.permitSubtype ?? null,
    input.status ?? null,
    input.appliedDate ?? null,
    input.issuedDate ?? null,
    input.finaledDate ?? null,
    input.address ?? null,
    input.city ?? null,
    input.parcelNumber ?? null,
    input.applicant ?? null,
    input.contractor ?? null,
    input.valuation ?? null,
    input.description,
    JSON.stringify(input.raw),
    input.contentHash,
    now,
    now,
  ];

  if (resolveDatabaseProvider() === "postgres") {
    await queryPostgres(
      `INSERT INTO permit_records (
        id,
        source_document_id,
        market_id,
        jurisdiction,
        permit_number,
        permit_type,
        permit_subtype,
        status,
        applied_date,
        issued_date,
        finaled_date,
        address,
        city,
        parcel_number,
        applicant,
        contractor,
        valuation,
        description,
        raw_json,
        content_hash,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      ON CONFLICT (market_id, permit_number) DO UPDATE SET
        source_document_id = EXCLUDED.source_document_id,
        jurisdiction = EXCLUDED.jurisdiction,
        permit_type = EXCLUDED.permit_type,
        permit_subtype = EXCLUDED.permit_subtype,
        status = EXCLUDED.status,
        applied_date = EXCLUDED.applied_date,
        issued_date = EXCLUDED.issued_date,
        finaled_date = EXCLUDED.finaled_date,
        address = EXCLUDED.address,
        city = EXCLUDED.city,
        parcel_number = EXCLUDED.parcel_number,
        applicant = EXCLUDED.applicant,
        contractor = EXCLUDED.contractor,
        valuation = EXCLUDED.valuation,
        description = EXCLUDED.description,
        raw_json = EXCLUDED.raw_json,
        content_hash = EXCLUDED.content_hash,
        updated_at = EXCLUDED.updated_at`,
      values
    );
    return { id, action };
  }

  const db = getDatabase();
  db.prepare(
    `INSERT INTO permit_records (
      id,
      source_document_id,
      market_id,
      jurisdiction,
      permit_number,
      permit_type,
      permit_subtype,
      status,
      applied_date,
      issued_date,
      finaled_date,
      address,
      city,
      parcel_number,
      applicant,
      contractor,
      valuation,
      description,
      raw_json,
      content_hash,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(market_id, permit_number) DO UPDATE SET
      source_document_id = excluded.source_document_id,
      jurisdiction = excluded.jurisdiction,
      permit_type = excluded.permit_type,
      permit_subtype = excluded.permit_subtype,
      status = excluded.status,
      applied_date = excluded.applied_date,
      issued_date = excluded.issued_date,
      finaled_date = excluded.finaled_date,
      address = excluded.address,
      city = excluded.city,
      parcel_number = excluded.parcel_number,
      applicant = excluded.applicant,
      contractor = excluded.contractor,
      valuation = excluded.valuation,
      description = excluded.description,
      raw_json = excluded.raw_json,
      content_hash = excluded.content_hash,
      updated_at = excluded.updated_at`
  ).run(...values);

  return { id, action };
}

export async function startIngestionRun(input: IngestionRunInput) {
  const id = input.id ?? randomUUID();
  const startedAt = input.startedAt ?? new Date().toISOString();
  const values = [
    id,
    input.sourceDocumentId ?? null,
    input.marketId,
    input.status ?? "running",
    startedAt,
    null,
    0,
    0,
    0,
    null,
    JSON.stringify(input.metadata ?? {}),
  ];

  if (resolveDatabaseProvider() === "postgres") {
    await queryPostgres(
      `INSERT INTO ingestion_runs (
        id,
        source_document_id,
        market_id,
        status,
        started_at,
        finished_at,
        records_found,
        records_inserted,
        records_updated,
        error_message,
        metadata_json
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      values
    );
    return id;
  }

  const db = getDatabase();
  db.prepare(
    `INSERT INTO ingestion_runs (
      id,
      source_document_id,
      market_id,
      status,
      started_at,
      finished_at,
      records_found,
      records_inserted,
      records_updated,
      error_message,
      metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(...values);

  return id;
}

export async function finishIngestionRun(input: FinishIngestionRunInput) {
  const values = [
    input.status,
    input.finishedAt ?? new Date().toISOString(),
    input.recordsFound,
    input.recordsInserted,
    input.recordsUpdated,
    input.errorMessage ?? null,
    JSON.stringify(input.metadata ?? {}),
    input.id,
  ];

  if (resolveDatabaseProvider() === "postgres") {
    await queryPostgres(
      `UPDATE ingestion_runs SET
        status = $1,
        finished_at = $2,
        records_found = $3,
        records_inserted = $4,
        records_updated = $5,
        error_message = $6,
        metadata_json = $7
      WHERE id = $8`,
      values
    );
    return;
  }

  const db = getDatabase();
  db.prepare(
    `UPDATE ingestion_runs SET
      status = ?,
      finished_at = ?,
      records_found = ?,
      records_inserted = ?,
      records_updated = ?,
      error_message = ?,
      metadata_json = ?
    WHERE id = ?`
  ).run(...values);
}

export async function listDataHealthByMarket(): Promise<DataHealthMarket[]> {
  if (resolveDatabaseProvider() === "postgres") {
    const result = await queryPostgres<DataHealthMarket>(
      `WITH latest_runs AS (
        SELECT DISTINCT ON (market_id)
          market_id,
          status,
          started_at,
          finished_at,
          records_found,
          records_inserted,
          records_updated,
          error_message
        FROM ingestion_runs
        ORDER BY market_id, started_at DESC
      )
      SELECT
        COALESCE(documents.market_id, records.market_id, latest_runs.market_id) AS market_id,
        COALESCE(documents.source_documents, 0)::int AS source_documents,
        COALESCE(records.permit_records, 0)::int AS permit_records,
        documents.latest_accessed_at,
        latest_runs.started_at AS latest_run_started_at,
        latest_runs.finished_at AS latest_run_finished_at,
        latest_runs.status AS latest_run_status,
        latest_runs.records_found AS latest_run_records_found,
        latest_runs.records_inserted AS latest_run_records_inserted,
        latest_runs.records_updated AS latest_run_records_updated,
        latest_runs.error_message AS latest_run_error_message
      FROM (
        SELECT
          market_id,
          COUNT(*) AS source_documents,
          MAX(accessed_at) AS latest_accessed_at
        FROM source_documents
        GROUP BY market_id
      ) documents
      FULL OUTER JOIN (
        SELECT market_id, COUNT(*) AS permit_records
        FROM permit_records
        GROUP BY market_id
      ) records ON records.market_id = documents.market_id
      FULL OUTER JOIN latest_runs ON latest_runs.market_id = COALESCE(documents.market_id, records.market_id)
      ORDER BY market_id`
    );

    return result.rows;
  }

  const db = getDatabase();
  return db
    .prepare(
      `WITH markets AS (
        SELECT market_id FROM source_documents
        UNION
        SELECT market_id FROM permit_records
        UNION
        SELECT market_id FROM ingestion_runs
      ),
      latest_runs AS (
        SELECT run.*
        FROM ingestion_runs run
        INNER JOIN (
          SELECT market_id, MAX(started_at) AS latest_started_at
          FROM ingestion_runs
          GROUP BY market_id
        ) latest
          ON latest.market_id = run.market_id
          AND latest.latest_started_at = run.started_at
      )
      SELECT
        markets.market_id,
        COALESCE(documents.source_documents, 0) AS source_documents,
        COALESCE(records.permit_records, 0) AS permit_records,
        documents.latest_accessed_at,
        latest_runs.started_at AS latest_run_started_at,
        latest_runs.finished_at AS latest_run_finished_at,
        latest_runs.status AS latest_run_status,
        latest_runs.records_found AS latest_run_records_found,
        latest_runs.records_inserted AS latest_run_records_inserted,
        latest_runs.records_updated AS latest_run_records_updated,
        latest_runs.error_message AS latest_run_error_message
      FROM markets
      LEFT JOIN (
        SELECT
          market_id,
          COUNT(*) AS source_documents,
          MAX(accessed_at) AS latest_accessed_at
        FROM source_documents
        GROUP BY market_id
      ) documents ON documents.market_id = markets.market_id
      LEFT JOIN (
        SELECT market_id, COUNT(*) AS permit_records
        FROM permit_records
        GROUP BY market_id
      ) records ON records.market_id = markets.market_id
      LEFT JOIN latest_runs ON latest_runs.market_id = markets.market_id
      ORDER BY markets.market_id`
    )
    .all() as DataHealthMarket[];
}

export async function listRecentPermitRecords(limit = 100): Promise<StoredPermitRecord[]> {
  if (resolveDatabaseProvider() === "postgres") {
    const result = await queryPostgres<StoredPermitRecord>(
      `SELECT
        records.id,
        records.source_document_id,
        records.market_id,
        records.jurisdiction,
        records.permit_number,
        records.permit_type,
        records.permit_subtype,
        records.status,
        records.applied_date,
        records.issued_date,
        records.finaled_date,
        records.address,
        records.city,
        records.parcel_number,
        records.applicant,
        records.contractor,
        records.valuation,
        records.description,
        records.raw_json,
        records.content_hash,
        records.created_at,
        records.updated_at,
        documents.source_name,
        documents.source_url,
        documents.document_url,
        documents.report_label,
        documents.published_at,
        documents.accessed_at
      FROM permit_records records
      INNER JOIN source_documents documents ON documents.id = records.source_document_id
      ORDER BY
        COALESCE(records.issued_date, records.applied_date, records.updated_at) DESC,
        COALESCE(records.valuation, 0) DESC,
        records.updated_at DESC
      LIMIT $1`,
      [limit]
    );

    return result.rows;
  }

  const db = getDatabase();
  return db
    .prepare(
      `SELECT
        records.id,
        records.source_document_id,
        records.market_id,
        records.jurisdiction,
        records.permit_number,
        records.permit_type,
        records.permit_subtype,
        records.status,
        records.applied_date,
        records.issued_date,
        records.finaled_date,
        records.address,
        records.city,
        records.parcel_number,
        records.applicant,
        records.contractor,
        records.valuation,
        records.description,
        records.raw_json,
        records.content_hash,
        records.created_at,
        records.updated_at,
        documents.source_name,
        documents.source_url,
        documents.document_url,
        documents.report_label,
        documents.published_at,
        documents.accessed_at
      FROM permit_records records
      INNER JOIN source_documents documents ON documents.id = records.source_document_id
      ORDER BY
        COALESCE(records.issued_date, records.applied_date, records.updated_at) DESC,
        COALESCE(records.valuation, 0) DESC,
        records.updated_at DESC
      LIMIT ?`
    )
    .all(limit) as StoredPermitRecord[];
}
