import { createHash, randomUUID } from "node:crypto";

import { getDatabase, resolveDatabaseProvider } from "@/lib/db";
import { queryPostgres } from "@/lib/postgres";
import type {
  GraphAliasType,
  GraphEntity,
  GraphEntityAlias,
  GraphEntityDetail,
  GraphEntityType,
  GraphEvidence,
  GraphRelatedEntity,
  GraphRelationship,
  GraphRelationshipPath,
  GraphRelationshipType,
} from "@/types/graph";

type EntityRow = {
  id: string;
  entity_type: GraphEntityType;
  display_name: string;
  normalized_name: string;
  source_system: string | null;
  source_id: string | null;
  properties_json: string;
  confidence: number;
  created_at: string;
  updated_at: string;
  last_verified_at: string;
};

type AliasRow = {
  id: string;
  entity_id: string;
  alias: string;
  normalized_alias: string;
  alias_type: GraphAliasType;
  source_system: string | null;
  source_id: string | null;
  confidence: number;
  created_at: string;
  last_verified_at: string;
};

type RelationshipRow = {
  id: string;
  from_entity_id: string;
  to_entity_id: string;
  relationship_type: GraphRelationshipType;
  confidence: number;
  source_system: string | null;
  source_id: string | null;
  provenance_json: string;
  created_at: string;
  updated_at: string;
  last_verified_at: string;
};

type EvidenceRow = {
  id: string;
  relationship_id: string;
  evidence_key: string;
  label: string;
  report_label: string;
  url: string | null;
  page_url: string | null;
  record_id: string | null;
  published_at: string | null;
  accessed_at: string;
  excerpt: string;
  created_at: string;
};

export type GraphEntityInput = {
  entityType: GraphEntityType;
  displayName: string;
  aliases?: Array<{
    alias: string;
    aliasType?: GraphAliasType;
    sourceSystem?: string | null;
    sourceId?: string | null;
    confidence?: number;
  }>;
  sourceSystem?: string | null;
  sourceId?: string | null;
  properties?: Record<string, unknown>;
  confidence?: number;
  lastVerifiedAt?: string;
};

export type GraphRelationshipInput = {
  fromEntityId: string;
  toEntityId: string;
  relationshipType: GraphRelationshipType;
  confidence?: number;
  sourceSystem?: string | null;
  sourceId?: string | null;
  provenance?: Record<string, unknown>;
  lastVerifiedAt?: string;
  evidence?: Array<{
    evidenceKey: string;
    label: string;
    reportLabel: string;
    url?: string | null;
    pageUrl?: string | null;
    recordId?: string | null;
    publishedAt?: string | null;
    accessedAt: string;
    excerpt: string;
  }>;
};

export function normalizeGraphValue(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(?:llc|l l c|inc|corp|corporation|co|company|lp|llp|ltd)\b/g, "")
    .replace(/\b(street|str)\b/g, "st")
    .replace(/\b(avenue|av)\b/g, "ave")
    .replace(/\b(boulevard)\b/g, "blvd")
    .replace(/\b(road)\b/g, "rd")
    .replace(/\b(drive)\b/g, "dr")
    .replace(/\b(north)\b/g, "n")
    .replace(/\b(south)\b/g, "s")
    .replace(/\b(east)\b/g, "e")
    .replace(/\b(west)\b/g, "w")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stableGraphId(prefix: string, parts: Array<string | null | undefined>) {
  const hash = createHash("sha256")
    .update(parts.filter(Boolean).join("|"))
    .digest("hex")
    .slice(0, 24);
  return `${prefix}-${hash}`;
}

function parseJson(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function entityFromRow(row: EntityRow): GraphEntity {
  return {
    id: row.id,
    entityType: row.entity_type,
    displayName: row.display_name,
    normalizedName: row.normalized_name,
    sourceSystem: row.source_system,
    sourceId: row.source_id,
    properties: parseJson(row.properties_json),
    confidence: Number(row.confidence),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastVerifiedAt: row.last_verified_at,
  };
}

function aliasFromRow(row: AliasRow): GraphEntityAlias {
  return {
    id: row.id,
    entityId: row.entity_id,
    alias: row.alias,
    normalizedAlias: row.normalized_alias,
    aliasType: row.alias_type,
    sourceSystem: row.source_system,
    sourceId: row.source_id,
    confidence: Number(row.confidence),
    createdAt: row.created_at,
    lastVerifiedAt: row.last_verified_at,
  };
}

function evidenceFromRow(row: EvidenceRow): GraphEvidence {
  return {
    id: row.id,
    evidenceKey: row.evidence_key,
    label: row.label,
    reportLabel: row.report_label,
    url: row.url,
    pageUrl: row.page_url,
    recordId: row.record_id,
    publishedAt: row.published_at,
    accessedAt: row.accessed_at,
    excerpt: row.excerpt,
    createdAt: row.created_at,
  };
}

async function listEvidence(relationshipId: string): Promise<GraphEvidence[]> {
  if (resolveDatabaseProvider() === "postgres") {
    const result = await queryPostgres<EvidenceRow>(
      `SELECT * FROM graph_relationship_evidence
      WHERE relationship_id = $1
      ORDER BY created_at DESC`,
      [relationshipId]
    );
    return result.rows.map(evidenceFromRow);
  }

  const db = getDatabase();
  return (
    db
      .prepare(
        `SELECT * FROM graph_relationship_evidence
        WHERE relationship_id = ?
        ORDER BY created_at DESC`
      )
      .all(relationshipId) as EvidenceRow[]
  ).map(evidenceFromRow);
}

async function relationshipFromRow(row: RelationshipRow): Promise<GraphRelationship> {
  return {
    id: row.id,
    fromEntityId: row.from_entity_id,
    toEntityId: row.to_entity_id,
    relationshipType: row.relationship_type,
    confidence: Number(row.confidence),
    sourceSystem: row.source_system,
    sourceId: row.source_id,
    provenance: parseJson(row.provenance_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastVerifiedAt: row.last_verified_at,
    evidence: await listEvidence(row.id),
  };
}

function levenshtein(left: string, right: string) {
  if (left === right) {
    return 0;
  }

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    let diagonal = previous[0];
    previous[0] = leftIndex + 1;

    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const upper = previous[rightIndex + 1];
      const cost = left[leftIndex] === right[rightIndex] ? 0 : 1;
      previous[rightIndex + 1] = Math.min(
        previous[rightIndex + 1] + 1,
        previous[rightIndex] + 1,
        diagonal + cost
      );
      diagonal = upper;
    }
  }

  return previous[right.length];
}

function similarity(left: string, right: string) {
  if (!left || !right) {
    return 0;
  }

  const distance = levenshtein(left, right);
  return 1 - distance / Math.max(left.length, right.length);
}

async function getEntityById(entityId: string): Promise<GraphEntity | null> {
  if (resolveDatabaseProvider() === "postgres") {
    const result = await queryPostgres<EntityRow>("SELECT * FROM graph_entities WHERE id = $1", [
      entityId,
    ]);
    return result.rows[0] ? entityFromRow(result.rows[0]) : null;
  }

  const db = getDatabase();
  const row = db.prepare("SELECT * FROM graph_entities WHERE id = ?").get(entityId) as
    | EntityRow
    | undefined;
  return row ? entityFromRow(row) : null;
}

async function findEntityBySource(input: GraphEntityInput): Promise<GraphEntity | null> {
  if (!input.sourceSystem || !input.sourceId) {
    return null;
  }

  if (resolveDatabaseProvider() === "postgres") {
    const result = await queryPostgres<EntityRow>(
      `SELECT * FROM graph_entities
      WHERE entity_type = $1 AND source_system = $2 AND source_id = $3
      LIMIT 1`,
      [input.entityType, input.sourceSystem, input.sourceId]
    );
    return result.rows[0] ? entityFromRow(result.rows[0]) : null;
  }

  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT * FROM graph_entities
      WHERE entity_type = ? AND source_system = ? AND source_id = ?
      LIMIT 1`
    )
    .get(input.entityType, input.sourceSystem, input.sourceId) as EntityRow | undefined;
  return row ? entityFromRow(row) : null;
}

async function findEntityByAlias(
  entityType: GraphEntityType,
  normalizedAlias: string
): Promise<GraphEntity | null> {
  if (resolveDatabaseProvider() === "postgres") {
    const result = await queryPostgres<EntityRow>(
      `SELECT entities.*
      FROM graph_entity_aliases aliases
      INNER JOIN graph_entities entities ON entities.id = aliases.entity_id
      WHERE entities.entity_type = $1 AND aliases.normalized_alias = $2
      ORDER BY aliases.confidence DESC, aliases.last_verified_at DESC
      LIMIT 1`,
      [entityType, normalizedAlias]
    );
    return result.rows[0] ? entityFromRow(result.rows[0]) : null;
  }

  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT entities.*
      FROM graph_entity_aliases aliases
      INNER JOIN graph_entities entities ON entities.id = aliases.entity_id
      WHERE entities.entity_type = ? AND aliases.normalized_alias = ?
      ORDER BY aliases.confidence DESC, aliases.last_verified_at DESC
      LIMIT 1`
    )
    .get(entityType, normalizedAlias) as EntityRow | undefined;
  return row ? entityFromRow(row) : null;
}

async function findFuzzyEntity(input: GraphEntityInput): Promise<GraphEntity | null> {
  const normalizedName = normalizeGraphValue(input.displayName);

  if (normalizedName.length < 6) {
    return null;
  }

  const rows =
    resolveDatabaseProvider() === "postgres"
      ? (
          await queryPostgres<EntityRow>(
            `SELECT * FROM graph_entities
            WHERE entity_type = $1
            ORDER BY updated_at DESC
            LIMIT 100`,
            [input.entityType]
          )
        ).rows
      : (getDatabase()
          .prepare(
            `SELECT * FROM graph_entities
            WHERE entity_type = ?
            ORDER BY updated_at DESC
            LIMIT 100`
          )
          .all(input.entityType) as EntityRow[]);

  const match = rows
    .map((row) => ({ row, score: similarity(normalizedName, row.normalized_name) }))
    .sort((left, right) => right.score - left.score)[0];

  return match && match.score >= 0.92 ? entityFromRow(match.row) : null;
}

async function findBestEntityMatch(input: GraphEntityInput) {
  const normalizedAliases = [
    normalizeGraphValue(input.displayName),
    ...(input.aliases ?? []).map((alias) => normalizeGraphValue(alias.alias)),
  ].filter(Boolean);

  return (
    (await findEntityBySource(input)) ??
    (await Promise.all(
      normalizedAliases.map((normalizedAlias) =>
        findEntityByAlias(input.entityType, normalizedAlias)
      )
    )).find(Boolean) ??
    (await findFuzzyEntity(input))
  );
}

async function insertAlias(
  entityId: string,
  alias: NonNullable<GraphEntityInput["aliases"]>[number],
  fallbackSourceSystem: string | null,
  fallbackSourceId: string | null,
  now: string
) {
  const normalizedAlias = normalizeGraphValue(alias.alias);

  if (!normalizedAlias) {
    return;
  }

  const id = stableGraphId("alias", [
    entityId,
    alias.aliasType ?? "name",
    normalizedAlias,
    alias.sourceSystem ?? fallbackSourceSystem,
    alias.sourceId ?? fallbackSourceId,
  ]);
  const values = [
    id,
    entityId,
    alias.alias,
    normalizedAlias,
    alias.aliasType ?? "name",
    alias.sourceSystem ?? fallbackSourceSystem,
    alias.sourceId ?? fallbackSourceId,
    alias.confidence ?? 0.86,
    now,
    now,
  ];

  if (resolveDatabaseProvider() === "postgres") {
    await queryPostgres(
      `INSERT INTO graph_entity_aliases (
        id, entity_id, alias, normalized_alias, alias_type, source_system, source_id,
        confidence, created_at, last_verified_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        confidence = GREATEST(graph_entity_aliases.confidence, EXCLUDED.confidence),
        last_verified_at = EXCLUDED.last_verified_at`,
      values
    );
    return;
  }

  getDatabase()
    .prepare(
      `INSERT INTO graph_entity_aliases (
        id, entity_id, alias, normalized_alias, alias_type, source_system, source_id,
        confidence, created_at, last_verified_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        confidence = MAX(confidence, excluded.confidence),
        last_verified_at = excluded.last_verified_at`
    )
    .run(...values);
}

export async function upsertGraphEntity(input: GraphEntityInput): Promise<GraphEntity> {
  const now = new Date().toISOString();
  const normalizedName = normalizeGraphValue(input.displayName);
  const existing = await findBestEntityMatch(input);
  const id =
    existing?.id ??
    stableGraphId("entity", [
      input.entityType,
      input.sourceSystem,
      input.sourceId,
      normalizedName,
    ]);
  const values = [
    id,
    input.entityType,
    input.displayName,
    normalizedName,
    input.sourceSystem ?? null,
    input.sourceId ?? null,
    JSON.stringify(input.properties ?? {}),
    input.confidence ?? 0.82,
    now,
    now,
    input.lastVerifiedAt ?? now,
  ];

  if (resolveDatabaseProvider() === "postgres") {
    await queryPostgres(
      `INSERT INTO graph_entities (
        id, entity_type, display_name, normalized_name, source_system, source_id,
        properties_json, confidence, created_at, updated_at, last_verified_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        normalized_name = EXCLUDED.normalized_name,
        source_system = COALESCE(graph_entities.source_system, EXCLUDED.source_system),
        source_id = COALESCE(graph_entities.source_id, EXCLUDED.source_id),
        properties_json = EXCLUDED.properties_json,
        confidence = GREATEST(graph_entities.confidence, EXCLUDED.confidence),
        updated_at = EXCLUDED.updated_at,
        last_verified_at = EXCLUDED.last_verified_at`,
      values
    );
  } else {
    getDatabase()
      .prepare(
        `INSERT INTO graph_entities (
          id, entity_type, display_name, normalized_name, source_system, source_id,
          properties_json, confidence, created_at, updated_at, last_verified_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          display_name = excluded.display_name,
          normalized_name = excluded.normalized_name,
          source_system = COALESCE(source_system, excluded.source_system),
          source_id = COALESCE(source_id, excluded.source_id),
          properties_json = excluded.properties_json,
          confidence = MAX(confidence, excluded.confidence),
          updated_at = excluded.updated_at,
          last_verified_at = excluded.last_verified_at`
      )
      .run(...values);
  }

  await insertAlias(
    id,
    { alias: input.displayName, aliasType: "name", confidence: input.confidence ?? 0.9 },
    input.sourceSystem ?? null,
    input.sourceId ?? null,
    now
  );

  for (const alias of input.aliases ?? []) {
    await insertAlias(id, alias, input.sourceSystem ?? null, input.sourceId ?? null, now);
  }

  const entity = await getEntityById(id);

  if (!entity) {
    throw new Error(`Failed to upsert graph entity ${id}.`);
  }

  return entity;
}

async function findRelationship(input: GraphRelationshipInput) {
  if (input.sourceSystem && input.sourceId) {
    if (resolveDatabaseProvider() === "postgres") {
      const result = await queryPostgres<RelationshipRow>(
        `SELECT * FROM graph_relationships
        WHERE from_entity_id = $1 AND to_entity_id = $2 AND relationship_type = $3
          AND source_system = $4 AND source_id = $5
        LIMIT 1`,
        [
          input.fromEntityId,
          input.toEntityId,
          input.relationshipType,
          input.sourceSystem,
          input.sourceId,
        ]
      );
      return result.rows[0] ?? null;
    }

    return (
      getDatabase()
        .prepare(
          `SELECT * FROM graph_relationships
          WHERE from_entity_id = ? AND to_entity_id = ? AND relationship_type = ?
            AND source_system = ? AND source_id = ?
          LIMIT 1`
        )
        .get(
          input.fromEntityId,
          input.toEntityId,
          input.relationshipType,
          input.sourceSystem,
          input.sourceId
        ) as RelationshipRow | undefined
    ) ?? null;
  }

  return null;
}

export async function upsertGraphRelationship(
  input: GraphRelationshipInput
): Promise<GraphRelationship> {
  const now = new Date().toISOString();
  const existing = await findRelationship(input);
  const id =
    existing?.id ??
    stableGraphId("rel", [
      input.fromEntityId,
      input.relationshipType,
      input.toEntityId,
      input.sourceSystem,
      input.sourceId,
    ]);
  const values = [
    id,
    input.fromEntityId,
    input.toEntityId,
    input.relationshipType,
    input.confidence ?? 0.78,
    input.sourceSystem ?? null,
    input.sourceId ?? null,
    JSON.stringify(input.provenance ?? {}),
    now,
    now,
    input.lastVerifiedAt ?? now,
  ];

  if (resolveDatabaseProvider() === "postgres") {
    await queryPostgres(
      `INSERT INTO graph_relationships (
        id, from_entity_id, to_entity_id, relationship_type, confidence, source_system,
        source_id, provenance_json, created_at, updated_at, last_verified_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO UPDATE SET
        confidence = GREATEST(graph_relationships.confidence, EXCLUDED.confidence),
        provenance_json = EXCLUDED.provenance_json,
        updated_at = EXCLUDED.updated_at,
        last_verified_at = EXCLUDED.last_verified_at`,
      values
    );
    await queryPostgres("DELETE FROM graph_relationship_evidence WHERE relationship_id = $1", [
      id,
    ]);
  } else {
    const db = getDatabase();
    db.prepare(
      `INSERT INTO graph_relationships (
        id, from_entity_id, to_entity_id, relationship_type, confidence, source_system,
        source_id, provenance_json, created_at, updated_at, last_verified_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        confidence = MAX(confidence, excluded.confidence),
        provenance_json = excluded.provenance_json,
        updated_at = excluded.updated_at,
        last_verified_at = excluded.last_verified_at`
    ).run(...values);
    db.prepare("DELETE FROM graph_relationship_evidence WHERE relationship_id = ?").run(id);
  }

  for (const evidence of input.evidence ?? []) {
    const evidenceId = stableGraphId("evidence", [id, evidence.evidenceKey]);
    const evidenceValues = [
      evidenceId,
      id,
      evidence.evidenceKey,
      evidence.label,
      evidence.reportLabel,
      evidence.url ?? null,
      evidence.pageUrl ?? null,
      evidence.recordId ?? null,
      evidence.publishedAt ?? null,
      evidence.accessedAt,
      evidence.excerpt,
      now,
    ];

    if (resolveDatabaseProvider() === "postgres") {
      await queryPostgres(
        `INSERT INTO graph_relationship_evidence (
          id, relationship_id, evidence_key, label, report_label, url, page_url,
          record_id, published_at, accessed_at, excerpt, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO NOTHING`,
        evidenceValues
      );
    } else {
      getDatabase()
        .prepare(
          `INSERT OR IGNORE INTO graph_relationship_evidence (
            id, relationship_id, evidence_key, label, report_label, url, page_url,
            record_id, published_at, accessed_at, excerpt, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(...evidenceValues);
    }
  }

  return getRelationshipById(id);
}

export async function getRelationshipById(id: string): Promise<GraphRelationship> {
  const row =
    resolveDatabaseProvider() === "postgres"
      ? (await queryPostgres<RelationshipRow>("SELECT * FROM graph_relationships WHERE id = $1", [
          id,
        ])).rows[0]
      : (getDatabase().prepare("SELECT * FROM graph_relationships WHERE id = ?").get(id) as
          | RelationshipRow
          | undefined);

  if (!row) {
    throw new Error(`Graph relationship ${id} not found.`);
  }

  return relationshipFromRow(row);
}

async function listAliases(entityId: string): Promise<GraphEntityAlias[]> {
  if (resolveDatabaseProvider() === "postgres") {
    const result = await queryPostgres<AliasRow>(
      `SELECT * FROM graph_entity_aliases WHERE entity_id = $1 ORDER BY confidence DESC`,
      [entityId]
    );
    return result.rows.map(aliasFromRow);
  }

  return (
    getDatabase()
      .prepare("SELECT * FROM graph_entity_aliases WHERE entity_id = ? ORDER BY confidence DESC")
      .all(entityId) as AliasRow[]
  ).map(aliasFromRow);
}

async function listRelationshipRows(entityId: string): Promise<RelationshipRow[]> {
  if (resolveDatabaseProvider() === "postgres") {
    const result = await queryPostgres<RelationshipRow>(
      `SELECT * FROM graph_relationships
      WHERE from_entity_id = $1 OR to_entity_id = $1
      ORDER BY confidence DESC, last_verified_at DESC`,
      [entityId]
    );
    return result.rows;
  }

  return getDatabase()
    .prepare(
      `SELECT * FROM graph_relationships
      WHERE from_entity_id = ? OR to_entity_id = ?
      ORDER BY confidence DESC, last_verified_at DESC`
    )
    .all(entityId, entityId) as RelationshipRow[];
}

export async function listRelatedEntities(entityId: string): Promise<GraphRelatedEntity[]> {
  const relationshipRows = await listRelationshipRows(entityId);
  const related: GraphRelatedEntity[] = [];

  for (const row of relationshipRows) {
    const direction = row.from_entity_id === entityId ? "outbound" : "inbound";
    const relatedEntityId = direction === "outbound" ? row.to_entity_id : row.from_entity_id;
    const entity = await getEntityById(relatedEntityId);

    if (entity) {
      related.push({
        entity,
        relationship: await relationshipFromRow(row),
        direction,
      });
    }
  }

  return related;
}

export async function getGraphEntityDetail(entityId: string): Promise<GraphEntityDetail | null> {
  const entity = await getEntityById(entityId);

  if (!entity) {
    return null;
  }

  return {
    ...entity,
    aliases: await listAliases(entityId),
    related: await listRelatedEntities(entityId),
  };
}

export async function findRelationshipPaths(
  fromEntityId: string,
  toEntityId: string,
  maxDepth = 3
): Promise<GraphRelationshipPath[]> {
  const paths: GraphRelationshipPath[] = [];
  const queue: Array<{ entityIds: string[]; relationshipIds: string[] }> = [
    { entityIds: [fromEntityId], relationshipIds: [] },
  ];

  while (queue.length > 0 && paths.length < 10) {
    const current = queue.shift();

    if (!current) {
      break;
    }

    const lastEntityId = current.entityIds[current.entityIds.length - 1];

    if (lastEntityId === toEntityId) {
      const entities = (
        await Promise.all(current.entityIds.map((entityId) => getEntityById(entityId)))
      ).filter((entity): entity is GraphEntity => Boolean(entity));
      const relationships = await Promise.all(
        current.relationshipIds.map((relationshipId) => getRelationshipById(relationshipId))
      );
      paths.push({ entities, relationships });
      continue;
    }

    if (current.relationshipIds.length >= maxDepth) {
      continue;
    }

    for (const related of await listRelatedEntities(lastEntityId)) {
      if (current.entityIds.includes(related.entity.id)) {
        continue;
      }

      queue.push({
        entityIds: [...current.entityIds, related.entity.id],
        relationshipIds: [...current.relationshipIds, related.relationship.id],
      });
    }
  }

  return paths;
}

export function graphIdForOpportunity(opportunityId: string) {
  return stableGraphId("entity", ["opportunity", "build-signals", opportunityId]);
}

export function graphIdForPermit(marketId: string, permitNumber: string) {
  return stableGraphId("entity", ["permit", "permit", marketId, permitNumber]);
}
