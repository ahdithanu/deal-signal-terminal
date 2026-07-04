import { randomUUID } from "node:crypto";

import { getDatabase, resolveDatabaseProvider } from "@/lib/db";
import { queryPostgres } from "@/lib/postgres";
import type {
  EmbeddingProvider,
  FeatureFlags,
  ModelProvider,
  NotificationChannel,
  NotificationRule,
  NotificationTrigger,
  PromptTemplateSelection,
  RateLimits,
  ScoringWeights,
  WorkspaceDeploymentConfig,
  WorkspaceDeploymentConfigHistory,
  WorkspaceDeploymentConfigInput,
  WorkspaceDeploymentSection,
} from "@/types/deployment-config";

const MODEL_PROVIDERS = new Set<ModelProvider>([
  "openai",
  "anthropic",
  "azure_openai",
  "google",
  "local",
  "none",
]);
const EMBEDDING_PROVIDERS = new Set<EmbeddingProvider>([
  "openai",
  "cohere",
  "voyage",
  "local",
  "none",
]);
const PROMPT_TEMPLATES = new Set<PromptTemplateSelection>([
  "default",
  "enterprise_ic_memo",
  "risk_first",
  "broker_outreach",
  "source_audit",
]);
const NOTIFICATION_CHANNELS = new Set<NotificationChannel>(["email", "slack", "webhook"]);
const NOTIFICATION_TRIGGERS = new Set<NotificationTrigger>([
  "opportunity_approved",
  "score_above_threshold",
  "review_requested",
  "ingestion_failed",
]);
const SECRET_REF_PATTERN = /^(env|secret|vault):[A-Z0-9_./:-]+$/i;

export const DEFAULT_WORKSPACE_DEPLOYMENT_CONFIG: Omit<
  WorkspaceDeploymentConfig,
  "id" | "orgId" | "createdAt" | "updatedAt" | "updatedByUserId"
> = {
  modelProvider: "openai",
  modelName: "gpt-4.1-mini",
  modelSecretRef: "env:OPENAI_API_KEY",
  embeddingProvider: "openai",
  embeddingModelName: "text-embedding-3-small",
  embeddingSecretRef: "env:OPENAI_API_KEY",
  retrievalDepth: 8,
  confidenceThreshold: 0.72,
  scoringWeights: {
    siteMotion: 1.4,
    ownershipSignal: 1,
    permitValue: 0.9,
    recency: 0.8,
    riskPenalty: 0.6,
  },
  promptTemplateSelection: "enterprise_ic_memo",
  notificationRules: [
    {
      id: "high-score-review",
      enabled: true,
      channel: "email",
      trigger: "score_above_threshold",
      targetRef: "env:BUILD_SIGNALS_NOTIFICATION_EMAIL",
      minimumScore: 82,
    },
  ],
  rateLimits: {
    aiRequestsPerMinute: 30,
    researchRunsPerDay: 200,
    memoGenerationsPerDay: 150,
    ingestRunsPerDay: 25,
  },
  featureFlags: {
    multiAgentResearch: true,
    knowledgeGraph: true,
    humanReviewWorkflow: true,
    nationwideIngestion: false,
    externalNotifications: false,
  },
};

type ConfigRow = {
  id: string;
  org_id: string;
  model_provider: ModelProvider;
  model_name: string;
  model_secret_ref: string | null;
  embedding_provider: EmbeddingProvider;
  embedding_model_name: string;
  embedding_secret_ref: string | null;
  retrieval_depth: number;
  confidence_threshold: number;
  scoring_weights_json: string;
  prompt_template_selection: PromptTemplateSelection;
  notification_rules_json: string;
  rate_limits_json: string;
  feature_flags_json: string;
  created_at: string;
  updated_at: string;
  updated_by_user_id: string | null;
};

type HistoryRow = {
  id: string;
  org_id: string;
  user_id: string | null;
  changed_at: string;
  section: WorkspaceDeploymentSection;
  old_value_json: string;
  new_value_json: string;
  metadata_json: string;
};

export class DeploymentConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeploymentConfigValidationError";
  }
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function rowToConfig(row: ConfigRow): WorkspaceDeploymentConfig {
  return {
    id: row.id,
    orgId: row.org_id,
    modelProvider: row.model_provider,
    modelName: row.model_name,
    modelSecretRef: row.model_secret_ref,
    embeddingProvider: row.embedding_provider,
    embeddingModelName: row.embedding_model_name,
    embeddingSecretRef: row.embedding_secret_ref,
    retrievalDepth: Number(row.retrieval_depth),
    confidenceThreshold: Number(row.confidence_threshold),
    scoringWeights: parseJson(row.scoring_weights_json, DEFAULT_WORKSPACE_DEPLOYMENT_CONFIG.scoringWeights),
    promptTemplateSelection: row.prompt_template_selection,
    notificationRules: parseJson(
      row.notification_rules_json,
      DEFAULT_WORKSPACE_DEPLOYMENT_CONFIG.notificationRules
    ),
    rateLimits: parseJson(row.rate_limits_json, DEFAULT_WORKSPACE_DEPLOYMENT_CONFIG.rateLimits),
    featureFlags: parseJson(row.feature_flags_json, DEFAULT_WORKSPACE_DEPLOYMENT_CONFIG.featureFlags),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedByUserId: row.updated_by_user_id,
  };
}

function historyRowToRecord(row: HistoryRow): WorkspaceDeploymentConfigHistory {
  return {
    id: row.id,
    orgId: row.org_id,
    userId: row.user_id,
    changedAt: row.changed_at,
    section: row.section,
    oldValue: parseJson(row.old_value_json, null),
    newValue: parseJson(row.new_value_json, null),
    metadata: parseJson(row.metadata_json, {}),
  };
}

function buildDefaultConfig(orgId: string): WorkspaceDeploymentConfig {
  const now = new Date().toISOString();

  return {
    id: `default-${orgId}`,
    orgId,
    ...DEFAULT_WORKSPACE_DEPLOYMENT_CONFIG,
    createdAt: now,
    updatedAt: now,
    updatedByUserId: null,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateSecretRef(value: string | null | undefined, field: string) {
  if (value == null || value === "") {
    return;
  }

  if (!SECRET_REF_PATTERN.test(value)) {
    throw new DeploymentConfigValidationError(
      `${field} must be a secure reference such as env:OPENAI_API_KEY, not a plaintext secret.`
    );
  }
}

function validateNumber(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new DeploymentConfigValidationError(`${field} must be a number between ${min} and ${max}.`);
  }

  return value;
}

function validateScoringWeights(value: unknown): ScoringWeights {
  if (!isPlainObject(value)) {
    throw new DeploymentConfigValidationError("scoringWeights must be an object.");
  }

  return {
    siteMotion: validateNumber(value.siteMotion, "scoringWeights.siteMotion", 0, 5),
    ownershipSignal: validateNumber(value.ownershipSignal, "scoringWeights.ownershipSignal", 0, 5),
    permitValue: validateNumber(value.permitValue, "scoringWeights.permitValue", 0, 5),
    recency: validateNumber(value.recency, "scoringWeights.recency", 0, 5),
    riskPenalty: validateNumber(value.riskPenalty, "scoringWeights.riskPenalty", 0, 5),
  };
}

function validateRateLimits(value: unknown): RateLimits {
  if (!isPlainObject(value)) {
    throw new DeploymentConfigValidationError("rateLimits must be an object.");
  }

  return {
    aiRequestsPerMinute: Math.floor(validateNumber(value.aiRequestsPerMinute, "rateLimits.aiRequestsPerMinute", 1, 500)),
    researchRunsPerDay: Math.floor(validateNumber(value.researchRunsPerDay, "rateLimits.researchRunsPerDay", 1, 10000)),
    memoGenerationsPerDay: Math.floor(
      validateNumber(value.memoGenerationsPerDay, "rateLimits.memoGenerationsPerDay", 1, 10000)
    ),
    ingestRunsPerDay: Math.floor(validateNumber(value.ingestRunsPerDay, "rateLimits.ingestRunsPerDay", 1, 1000)),
  };
}

function validateFeatureFlags(value: unknown): FeatureFlags {
  if (!isPlainObject(value)) {
    throw new DeploymentConfigValidationError("featureFlags must be an object.");
  }

  const readBoolean = (key: keyof FeatureFlags) => {
    if (typeof value[key] !== "boolean") {
      throw new DeploymentConfigValidationError(`featureFlags.${key} must be a boolean.`);
    }

    return value[key];
  };

  return {
    multiAgentResearch: readBoolean("multiAgentResearch"),
    knowledgeGraph: readBoolean("knowledgeGraph"),
    humanReviewWorkflow: readBoolean("humanReviewWorkflow"),
    nationwideIngestion: readBoolean("nationwideIngestion"),
    externalNotifications: readBoolean("externalNotifications"),
  };
}

function validateNotificationRules(value: unknown): NotificationRule[] {
  if (!Array.isArray(value)) {
    throw new DeploymentConfigValidationError("notificationRules must be an array.");
  }

  if (value.length > 20) {
    throw new DeploymentConfigValidationError("notificationRules cannot exceed 20 rules.");
  }

  return value.map((rule, index) => {
    if (!isPlainObject(rule)) {
      throw new DeploymentConfigValidationError(`notificationRules.${index} must be an object.`);
    }

    if (typeof rule.id !== "string" || rule.id.trim().length === 0) {
      throw new DeploymentConfigValidationError(`notificationRules.${index}.id is required.`);
    }

    if (typeof rule.enabled !== "boolean") {
      throw new DeploymentConfigValidationError(`notificationRules.${index}.enabled must be a boolean.`);
    }

    if (!NOTIFICATION_CHANNELS.has(rule.channel as NotificationChannel)) {
      throw new DeploymentConfigValidationError(`notificationRules.${index}.channel is not supported.`);
    }

    if (!NOTIFICATION_TRIGGERS.has(rule.trigger as NotificationTrigger)) {
      throw new DeploymentConfigValidationError(`notificationRules.${index}.trigger is not supported.`);
    }

    if (typeof rule.targetRef !== "string" || !SECRET_REF_PATTERN.test(rule.targetRef)) {
      throw new DeploymentConfigValidationError(
        `notificationRules.${index}.targetRef must be a secure reference such as env:SALES_ALERT_EMAIL.`
      );
    }

    return {
      id: rule.id.trim(),
      enabled: rule.enabled,
      channel: rule.channel as NotificationChannel,
      trigger: rule.trigger as NotificationTrigger,
      targetRef: rule.targetRef.trim(),
      minimumScore:
        rule.minimumScore == null
          ? undefined
          : validateNumber(rule.minimumScore, `notificationRules.${index}.minimumScore`, 0, 100),
    };
  });
}

export function validateDeploymentConfig(
  config: WorkspaceDeploymentConfigInput,
  base = DEFAULT_WORKSPACE_DEPLOYMENT_CONFIG
) {
  const merged = {
    ...base,
    ...config,
    scoringWeights: {
      ...base.scoringWeights,
      ...(config.scoringWeights ?? {}),
    },
    rateLimits: {
      ...base.rateLimits,
      ...(config.rateLimits ?? {}),
    },
    featureFlags: {
      ...base.featureFlags,
      ...(config.featureFlags ?? {}),
    },
    notificationRules: config.notificationRules ?? base.notificationRules,
  };

  if (!MODEL_PROVIDERS.has(merged.modelProvider)) {
    throw new DeploymentConfigValidationError("modelProvider is not supported.");
  }

  if (merged.modelProvider !== "none" && merged.modelName.trim().length < 2) {
    throw new DeploymentConfigValidationError("modelName is required when modelProvider is enabled.");
  }

  if (!EMBEDDING_PROVIDERS.has(merged.embeddingProvider)) {
    throw new DeploymentConfigValidationError("embeddingProvider is not supported.");
  }

  if (merged.embeddingProvider !== "none" && merged.embeddingModelName.trim().length < 2) {
    throw new DeploymentConfigValidationError(
      "embeddingModelName is required when embeddingProvider is enabled."
    );
  }

  if (!PROMPT_TEMPLATES.has(merged.promptTemplateSelection)) {
    throw new DeploymentConfigValidationError("promptTemplateSelection is not supported.");
  }

  validateSecretRef(merged.modelSecretRef, "modelSecretRef");
  validateSecretRef(merged.embeddingSecretRef, "embeddingSecretRef");

  return {
    modelProvider: merged.modelProvider,
    modelName: merged.modelName.trim(),
    modelSecretRef: merged.modelSecretRef?.trim() || null,
    embeddingProvider: merged.embeddingProvider,
    embeddingModelName: merged.embeddingModelName.trim(),
    embeddingSecretRef: merged.embeddingSecretRef?.trim() || null,
    retrievalDepth: Math.floor(validateNumber(merged.retrievalDepth, "retrievalDepth", 1, 50)),
    confidenceThreshold: validateNumber(merged.confidenceThreshold, "confidenceThreshold", 0, 1),
    scoringWeights: validateScoringWeights(merged.scoringWeights),
    promptTemplateSelection: merged.promptTemplateSelection,
    notificationRules: validateNotificationRules(merged.notificationRules),
    rateLimits: validateRateLimits(merged.rateLimits),
    featureFlags: validateFeatureFlags(merged.featureFlags),
  } satisfies typeof DEFAULT_WORKSPACE_DEPLOYMENT_CONFIG;
}

async function findConfigRow(orgId: string): Promise<ConfigRow | null> {
  if (resolveDatabaseProvider() === "postgres") {
    const result = await queryPostgres<ConfigRow>(
      `SELECT * FROM workspace_deployment_configs WHERE org_id = $1 LIMIT 1`,
      [orgId]
    );

    return result.rows[0] ?? null;
  }

  const db = getDatabase();
  return (db
    .prepare(`SELECT * FROM workspace_deployment_configs WHERE org_id = ? LIMIT 1`)
    .get(orgId) ?? null) as ConfigRow | null;
}

export async function getWorkspaceDeploymentConfig(orgId: string): Promise<WorkspaceDeploymentConfig> {
  const row = await findConfigRow(orgId);

  if (!row) {
    return buildDefaultConfig(orgId);
  }

  return rowToConfig(row);
}

function diffSections(
  before: WorkspaceDeploymentConfig,
  after: WorkspaceDeploymentConfig
): Array<{ section: WorkspaceDeploymentSection; oldValue: unknown; newValue: unknown }> {
  const sections: Array<{ section: WorkspaceDeploymentSection; oldValue: unknown; newValue: unknown }> = [
    {
      section: "ai_models",
      oldValue: {
        modelProvider: before.modelProvider,
        modelName: before.modelName,
        modelSecretRef: before.modelSecretRef,
        embeddingProvider: before.embeddingProvider,
        embeddingModelName: before.embeddingModelName,
        embeddingSecretRef: before.embeddingSecretRef,
        promptTemplateSelection: before.promptTemplateSelection,
      },
      newValue: {
        modelProvider: after.modelProvider,
        modelName: after.modelName,
        modelSecretRef: after.modelSecretRef,
        embeddingProvider: after.embeddingProvider,
        embeddingModelName: after.embeddingModelName,
        embeddingSecretRef: after.embeddingSecretRef,
        promptTemplateSelection: after.promptTemplateSelection,
      },
    },
    {
      section: "retrieval",
      oldValue: { retrievalDepth: before.retrievalDepth, confidenceThreshold: before.confidenceThreshold },
      newValue: { retrievalDepth: after.retrievalDepth, confidenceThreshold: after.confidenceThreshold },
    },
    { section: "scoring", oldValue: before.scoringWeights, newValue: after.scoringWeights },
    { section: "notifications", oldValue: before.notificationRules, newValue: after.notificationRules },
    { section: "rate_limits", oldValue: before.rateLimits, newValue: after.rateLimits },
    { section: "feature_flags", oldValue: before.featureFlags, newValue: after.featureFlags },
  ];

  return sections.filter(
    (section) => JSON.stringify(section.oldValue) !== JSON.stringify(section.newValue)
  );
}

async function insertHistory(
  orgId: string,
  userId: string,
  changedAt: string,
  changes: ReturnType<typeof diffSections>
) {
  for (const change of changes) {
    const values = [
      randomUUID(),
      orgId,
      userId,
      changedAt,
      change.section,
      JSON.stringify(change.oldValue),
      JSON.stringify(change.newValue),
      JSON.stringify({ source: "admin_deployment_console" }),
    ];

    if (resolveDatabaseProvider() === "postgres") {
      await queryPostgres(
        `INSERT INTO workspace_deployment_config_history (
          id, org_id, user_id, changed_at, section, old_value_json, new_value_json, metadata_json
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        values
      );
    } else {
      getDatabase()
        .prepare(
          `INSERT INTO workspace_deployment_config_history (
            id, org_id, user_id, changed_at, section, old_value_json, new_value_json, metadata_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(...values);
    }
  }
}

export async function updateWorkspaceDeploymentConfig({
  orgId,
  userId,
  input,
}: {
  orgId: string;
  userId: string;
  input: WorkspaceDeploymentConfigInput;
}) {
  const before = await getWorkspaceDeploymentConfig(orgId);
  const validated = validateDeploymentConfig(input, before);
  const now = new Date().toISOString();
  const existing = await findConfigRow(orgId);
  const next: WorkspaceDeploymentConfig = {
    ...before,
    ...validated,
    id: existing?.id ?? randomUUID(),
    createdAt: existing?.created_at ?? now,
    updatedAt: now,
    updatedByUserId: userId,
  };
  const changes = diffSections(before, next);

  if (changes.length === 0) {
    return { config: next, changes: [] };
  }

  const values = [
    next.id,
    next.orgId,
    next.modelProvider,
    next.modelName,
    next.modelSecretRef,
    next.embeddingProvider,
    next.embeddingModelName,
    next.embeddingSecretRef,
    next.retrievalDepth,
    next.confidenceThreshold,
    JSON.stringify(next.scoringWeights),
    next.promptTemplateSelection,
    JSON.stringify(next.notificationRules),
    JSON.stringify(next.rateLimits),
    JSON.stringify(next.featureFlags),
    next.createdAt,
    next.updatedAt,
    next.updatedByUserId,
  ];

  if (resolveDatabaseProvider() === "postgres") {
    await queryPostgres(
      `INSERT INTO workspace_deployment_configs (
        id, org_id, model_provider, model_name, model_secret_ref, embedding_provider,
        embedding_model_name, embedding_secret_ref, retrieval_depth, confidence_threshold,
        scoring_weights_json, prompt_template_selection, notification_rules_json,
        rate_limits_json, feature_flags_json, created_at, updated_at, updated_by_user_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
      )
      ON CONFLICT (org_id) DO UPDATE SET
        model_provider = EXCLUDED.model_provider,
        model_name = EXCLUDED.model_name,
        model_secret_ref = EXCLUDED.model_secret_ref,
        embedding_provider = EXCLUDED.embedding_provider,
        embedding_model_name = EXCLUDED.embedding_model_name,
        embedding_secret_ref = EXCLUDED.embedding_secret_ref,
        retrieval_depth = EXCLUDED.retrieval_depth,
        confidence_threshold = EXCLUDED.confidence_threshold,
        scoring_weights_json = EXCLUDED.scoring_weights_json,
        prompt_template_selection = EXCLUDED.prompt_template_selection,
        notification_rules_json = EXCLUDED.notification_rules_json,
        rate_limits_json = EXCLUDED.rate_limits_json,
        feature_flags_json = EXCLUDED.feature_flags_json,
        updated_at = EXCLUDED.updated_at,
        updated_by_user_id = EXCLUDED.updated_by_user_id`,
      values
    );
  } else {
    getDatabase()
      .prepare(
        `INSERT INTO workspace_deployment_configs (
          id, org_id, model_provider, model_name, model_secret_ref, embedding_provider,
          embedding_model_name, embedding_secret_ref, retrieval_depth, confidence_threshold,
          scoring_weights_json, prompt_template_selection, notification_rules_json,
          rate_limits_json, feature_flags_json, created_at, updated_at, updated_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(org_id) DO UPDATE SET
          model_provider = excluded.model_provider,
          model_name = excluded.model_name,
          model_secret_ref = excluded.model_secret_ref,
          embedding_provider = excluded.embedding_provider,
          embedding_model_name = excluded.embedding_model_name,
          embedding_secret_ref = excluded.embedding_secret_ref,
          retrieval_depth = excluded.retrieval_depth,
          confidence_threshold = excluded.confidence_threshold,
          scoring_weights_json = excluded.scoring_weights_json,
          prompt_template_selection = excluded.prompt_template_selection,
          notification_rules_json = excluded.notification_rules_json,
          rate_limits_json = excluded.rate_limits_json,
          feature_flags_json = excluded.feature_flags_json,
          updated_at = excluded.updated_at,
          updated_by_user_id = excluded.updated_by_user_id`
      )
      .run(...values);
  }

  await insertHistory(orgId, userId, now, changes);

  return { config: next, changes };
}

export async function listWorkspaceDeploymentConfigHistory(orgId: string, limit = 50) {
  if (resolveDatabaseProvider() === "postgres") {
    const result = await queryPostgres<HistoryRow>(
      `SELECT * FROM workspace_deployment_config_history
       WHERE org_id = $1
       ORDER BY changed_at DESC
       LIMIT $2`,
      [orgId, limit]
    );

    return result.rows.map(historyRowToRecord);
  }

  const rows = getDatabase()
    .prepare(
      `SELECT * FROM workspace_deployment_config_history
       WHERE org_id = ?
       ORDER BY changed_at DESC
       LIMIT ?`
    )
    .all(orgId, limit) as HistoryRow[];

  return rows.map(historyRowToRecord);
}
