import { randomUUID } from "node:crypto";

import { getDatabase, resolveDatabaseProvider } from "@/lib/db";
import { queryPostgres } from "@/lib/postgres";
import type {
  CreatePromptVersionInput,
  PromptRegistryEvent,
  PromptTemplate,
  PromptTemplateStatus,
  PromptVersion,
  PromptVersionStatus,
  PromptWorkflow,
} from "@/types/prompt-registry";

type TemplateRow = {
  id: string;
  prompt_key: string;
  name: string;
  description: string;
  workflow: PromptWorkflow;
  status: PromptTemplateStatus;
  active_version_id: string | null;
  created_at: string;
  updated_at: string;
};

type VersionRow = {
  id: string;
  template_id: string;
  version: string;
  status: PromptVersionStatus;
  prompt_body: string;
  variables_json: string;
  output_schema_json: string;
  model_family: string;
  changelog: string;
  created_by_user_id: string | null;
  created_at: string;
  activated_at: string | null;
};

type EventRow = {
  id: string;
  template_id: string;
  version_id: string | null;
  user_id: string | null;
  action: string;
  occurred_at: string;
  metadata_json: string;
};

type DefaultPrompt = {
  promptKey: string;
  name: string;
  description: string;
  workflow: PromptWorkflow;
  version: string;
  promptBody: string;
  variables: string[];
  outputSchema: Record<string, unknown>;
  modelFamily: string;
  changelog: string;
};

const DEFAULT_PROMPTS: DefaultPrompt[] = [
  {
    promptKey: "copilot.answer.v1",
    name: "Evidence-backed Copilot answer",
    description: "Answers customer questions with cited Build Signals evidence and next actions.",
    workflow: "copilot_answers",
    version: "copilot-answer-v1",
    promptBody:
      "Answer using only provided Build Signals context. Include direct answer, citations, confidence, assumptions, and next actions. Refuse when evidence is missing.",
    variables: ["question", "opportunities", "graphRelationships", "sourceEvidence"],
    outputSchema: {
      directAnswer: "string",
      citations: "array",
      confidence: "low|medium|high",
      assumptions: "array",
      suggestedNextActions: "array",
    },
    modelFamily: "structured-chat",
    changelog: "Initial evidence-backed Copilot prompt.",
  },
  {
    promptKey: "memo.executive.v1",
    name: "Executive opportunity memo",
    description: "Generates diligence-grade IC memo drafts with sourced facts and missing evidence.",
    workflow: "opportunity_memos",
    version: "executive-memo-v1",
    promptBody:
      "Draft an executive memo from the provided opportunity, source evidence, parcel context, graph context, and missing data. Never invent facts.",
    variables: ["opportunity", "sourceEvidence", "parcelContext", "graphContext", "missingFacts"],
    outputSchema: {
      situation: "string",
      whatChanged: "array",
      whyItMatters: "string",
      risks: "array",
      recommendedNextStep: "string",
    },
    modelFamily: "structured-chat",
    changelog: "Initial executive memo prompt.",
  },
  {
    promptKey: "research.coordinator.v1",
    name: "Multi-agent research coordinator",
    description: "Coordinates specialist agents and synthesizes a structured research packet.",
    workflow: "multi_agent_research",
    version: "multi-agent-research-v1",
    promptBody:
      "Call specialist agents, preserve their citations, resolve conflicts, list assumptions, and produce a final opportunity research packet.",
    variables: ["opportunity", "specialistOutputs", "sourceEvidence"],
    outputSchema: {
      specialistOutputs: "array",
      finalMemo: "object",
      conflicts: "array",
      missingData: "array",
    },
    modelFamily: "agent-orchestration",
    changelog: "Initial coordinator prompt matching current research agent metadata.",
  },
  {
    promptKey: "score.explanation.v1",
    name: "Score explanation",
    description: "Explains priority score contributors, limiters, confidence, and source citations.",
    workflow: "score_explanations",
    version: "score-explanation-v1",
    promptBody:
      "Explain the opportunity score using scoring contributors, evidence, confidence, and known limiters. Do not cite unavailable facts.",
    variables: ["opportunity", "scoreBreakdown", "sourceEvidence"],
    outputSchema: {
      scoreSummary: "string",
      contributors: "array",
      limiters: "array",
      citations: "array",
    },
    modelFamily: "structured-chat",
    changelog: "Initial score explanation prompt.",
  },
];

function nowIso() {
  return new Date().toISOString();
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function versionFromRow(row: VersionRow): PromptVersion {
  return {
    id: row.id,
    templateId: row.template_id,
    version: row.version,
    status: row.status,
    promptBody: row.prompt_body,
    variables: parseJson(row.variables_json, []),
    outputSchema: parseJson(row.output_schema_json, {}),
    modelFamily: row.model_family,
    changelog: row.changelog,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    activatedAt: row.activated_at,
  };
}

function templateFromRow(row: TemplateRow, versions: PromptVersion[] = []): PromptTemplate {
  return {
    id: row.id,
    promptKey: row.prompt_key,
    name: row.name,
    description: row.description,
    workflow: row.workflow,
    status: row.status,
    activeVersionId: row.active_version_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    activeVersion: versions.find((version) => version.id === row.active_version_id) ?? null,
    versions,
  };
}

function eventFromRow(row: EventRow): PromptRegistryEvent {
  return {
    id: row.id,
    templateId: row.template_id,
    versionId: row.version_id,
    userId: row.user_id,
    action: row.action,
    occurredAt: row.occurred_at,
    metadata: parseJson(row.metadata_json, {}),
  };
}

async function insertEvent(input: {
  templateId: string;
  versionId?: string | null;
  userId?: string | null;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  const values = [
    randomUUID(),
    input.templateId,
    input.versionId ?? null,
    input.userId ?? null,
    input.action,
    nowIso(),
    JSON.stringify(input.metadata ?? {}),
  ];

  if (resolveDatabaseProvider() === "postgres") {
    await queryPostgres(
      `INSERT INTO prompt_registry_events (
        id, template_id, version_id, user_id, action, occurred_at, metadata_json
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      values
    );
    return;
  }

  getDatabase()
    .prepare(
      `INSERT INTO prompt_registry_events (
        id, template_id, version_id, user_id, action, occurred_at, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(...values);
}

async function findTemplateByKey(promptKey: string): Promise<TemplateRow | null> {
  if (resolveDatabaseProvider() === "postgres") {
    const result = await queryPostgres<TemplateRow>(
      "SELECT * FROM prompt_templates WHERE prompt_key = $1 LIMIT 1",
      [promptKey]
    );
    return result.rows[0] ?? null;
  }

  return (getDatabase()
    .prepare("SELECT * FROM prompt_templates WHERE prompt_key = ? LIMIT 1")
    .get(promptKey) ?? null) as TemplateRow | null;
}

async function listVersionsForTemplate(templateId: string): Promise<PromptVersion[]> {
  if (resolveDatabaseProvider() === "postgres") {
    const result = await queryPostgres<VersionRow>(
      "SELECT * FROM prompt_versions WHERE template_id = $1 ORDER BY created_at DESC",
      [templateId]
    );
    return result.rows.map(versionFromRow);
  }

  const rows = getDatabase()
    .prepare("SELECT * FROM prompt_versions WHERE template_id = ? ORDER BY created_at DESC")
    .all(templateId) as VersionRow[];

  return rows.map(versionFromRow);
}

async function insertDefaultPrompt(prompt: DefaultPrompt) {
  const timestamp = nowIso();
  const templateId = randomUUID();
  const versionId = randomUUID();
  const templateValues = [
    templateId,
    prompt.promptKey,
    prompt.name,
    prompt.description,
    prompt.workflow,
    "active",
    versionId,
    timestamp,
    timestamp,
  ];
  const versionValues = [
    versionId,
    templateId,
    prompt.version,
    "active",
    prompt.promptBody,
    JSON.stringify(prompt.variables),
    JSON.stringify(prompt.outputSchema),
    prompt.modelFamily,
    prompt.changelog,
    null,
    timestamp,
    timestamp,
  ];

  if (resolveDatabaseProvider() === "postgres") {
    await queryPostgres(
      `INSERT INTO prompt_templates (
        id, prompt_key, name, description, workflow, status, active_version_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      templateValues
    );
    await queryPostgres(
      `INSERT INTO prompt_versions (
        id, template_id, version, status, prompt_body, variables_json, output_schema_json,
        model_family, changelog, created_by_user_id, created_at, activated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      versionValues
    );
  } else {
    const db = getDatabase();
    db.prepare(
      `INSERT INTO prompt_templates (
        id, prompt_key, name, description, workflow, status, active_version_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(...templateValues);
    db.prepare(
      `INSERT INTO prompt_versions (
        id, template_id, version, status, prompt_body, variables_json, output_schema_json,
        model_family, changelog, created_by_user_id, created_at, activated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(...versionValues);
  }

  await insertEvent({
    templateId,
    versionId,
    action: "seed",
    metadata: { promptKey: prompt.promptKey, version: prompt.version },
  });
}

export async function ensureDefaultPromptRegistry() {
  for (const prompt of DEFAULT_PROMPTS) {
    const existing = await findTemplateByKey(prompt.promptKey);

    if (!existing) {
      await insertDefaultPrompt(prompt);
    }
  }
}

export async function listPromptTemplates() {
  await ensureDefaultPromptRegistry();

  const rows =
    resolveDatabaseProvider() === "postgres"
      ? (await queryPostgres<TemplateRow>("SELECT * FROM prompt_templates ORDER BY workflow, name")).rows
      : (getDatabase()
          .prepare("SELECT * FROM prompt_templates ORDER BY workflow, name")
          .all() as TemplateRow[]);

  const templates = await Promise.all(
    rows.map(async (row) => templateFromRow(row, await listVersionsForTemplate(row.id)))
  );

  return templates;
}

export async function getPromptTemplate(promptKey: string) {
  await ensureDefaultPromptRegistry();
  const row = await findTemplateByKey(promptKey);

  if (!row) {
    return null;
  }

  return templateFromRow(row, await listVersionsForTemplate(row.id));
}

function validatePromptInput(input: CreatePromptVersionInput) {
  if (!input.promptKey.trim()) {
    throw new Error("promptKey is required.");
  }

  if (!/^[a-z0-9_.-]+$/i.test(input.promptKey)) {
    throw new Error("promptKey may only include letters, numbers, dots, dashes, and underscores.");
  }

  if (!input.version.trim()) {
    throw new Error("version is required.");
  }

  if (input.promptBody.trim().length < 20) {
    throw new Error("promptBody must be at least 20 characters.");
  }

  if (!Array.isArray(input.variables) || input.variables.some((variable) => typeof variable !== "string")) {
    throw new Error("variables must be an array of strings.");
  }
}

export async function createPromptVersion(input: CreatePromptVersionInput): Promise<PromptVersion> {
  await ensureDefaultPromptRegistry();
  validatePromptInput(input);
  const template = await findTemplateByKey(input.promptKey);

  if (!template) {
    throw new Error(`Unknown prompt template ${input.promptKey}.`);
  }

  const timestamp = nowIso();
  const version: PromptVersion = {
    id: randomUUID(),
    templateId: template.id,
    version: input.version.trim(),
    status: "draft",
    promptBody: input.promptBody.trim(),
    variables: input.variables.map((variable) => variable.trim()).filter(Boolean),
    outputSchema: input.outputSchema,
    modelFamily: input.modelFamily.trim() || "structured-chat",
    changelog: input.changelog.trim(),
    createdByUserId: input.createdByUserId ?? null,
    createdAt: timestamp,
    activatedAt: null,
  };
  const values = [
    version.id,
    version.templateId,
    version.version,
    version.status,
    version.promptBody,
    JSON.stringify(version.variables),
    JSON.stringify(version.outputSchema),
    version.modelFamily,
    version.changelog,
    version.createdByUserId,
    version.createdAt,
    version.activatedAt,
  ];

  if (resolveDatabaseProvider() === "postgres") {
    await queryPostgres(
      `INSERT INTO prompt_versions (
        id, template_id, version, status, prompt_body, variables_json, output_schema_json,
        model_family, changelog, created_by_user_id, created_at, activated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      values
    );
  } else {
    getDatabase()
      .prepare(
        `INSERT INTO prompt_versions (
          id, template_id, version, status, prompt_body, variables_json, output_schema_json,
          model_family, changelog, created_by_user_id, created_at, activated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(...values);
  }

  await insertEvent({
    templateId: template.id,
    versionId: version.id,
    userId: version.createdByUserId,
    action: "version.create",
    metadata: { version: version.version },
  });

  return version;
}

export async function activatePromptVersion({
  promptKey,
  versionId,
  userId,
}: {
  promptKey: string;
  versionId: string;
  userId?: string | null;
}) {
  await ensureDefaultPromptRegistry();
  const template = await findTemplateByKey(promptKey);

  if (!template) {
    throw new Error(`Unknown prompt template ${promptKey}.`);
  }

  const versions = await listVersionsForTemplate(template.id);
  const target = versions.find((version) => version.id === versionId);

  if (!target) {
    throw new Error("Prompt version does not belong to this template.");
  }

  const timestamp = nowIso();

  if (resolveDatabaseProvider() === "postgres") {
    await queryPostgres("UPDATE prompt_versions SET status = 'archived' WHERE template_id = $1", [
      template.id,
    ]);
    await queryPostgres(
      "UPDATE prompt_versions SET status = 'active', activated_at = $1 WHERE id = $2",
      [timestamp, versionId]
    );
    await queryPostgres(
      "UPDATE prompt_templates SET active_version_id = $1, updated_at = $2 WHERE id = $3",
      [versionId, timestamp, template.id]
    );
  } else {
    const db = getDatabase();
    db.prepare("UPDATE prompt_versions SET status = 'archived' WHERE template_id = ?").run(template.id);
    db.prepare("UPDATE prompt_versions SET status = 'active', activated_at = ? WHERE id = ?").run(
      timestamp,
      versionId
    );
    db.prepare("UPDATE prompt_templates SET active_version_id = ?, updated_at = ? WHERE id = ?").run(
      versionId,
      timestamp,
      template.id
    );
  }

  await insertEvent({
    templateId: template.id,
    versionId,
    userId,
    action: "version.activate",
    metadata: { promptKey, version: target.version },
  });

  return getPromptTemplate(promptKey);
}

export async function listPromptRegistryEvents(limit = 50) {
  const rows =
    resolveDatabaseProvider() === "postgres"
      ? (
          await queryPostgres<EventRow>(
            "SELECT * FROM prompt_registry_events ORDER BY occurred_at DESC LIMIT $1",
            [limit]
          )
        ).rows
      : (getDatabase()
          .prepare("SELECT * FROM prompt_registry_events ORDER BY occurred_at DESC LIMIT ?")
          .all(limit) as EventRow[]);

  return rows.map(eventFromRow);
}
