export type ModelProvider =
  | "openai"
  | "anthropic"
  | "azure_openai"
  | "google"
  | "local"
  | "none";

export type EmbeddingProvider = "openai" | "cohere" | "voyage" | "local" | "none";

export type PromptTemplateSelection =
  | "default"
  | "enterprise_ic_memo"
  | "risk_first"
  | "broker_outreach"
  | "source_audit";

export type NotificationChannel = "email" | "slack" | "webhook";

export type NotificationTrigger =
  | "opportunity_approved"
  | "score_above_threshold"
  | "review_requested"
  | "ingestion_failed";

export type WorkspaceDeploymentSection =
  | "ai_models"
  | "retrieval"
  | "scoring"
  | "notifications"
  | "rate_limits"
  | "feature_flags";

export type ScoringWeights = {
  siteMotion: number;
  ownershipSignal: number;
  permitValue: number;
  recency: number;
  riskPenalty: number;
};

export type NotificationRule = {
  id: string;
  enabled: boolean;
  channel: NotificationChannel;
  trigger: NotificationTrigger;
  targetRef: string;
  minimumScore?: number;
};

export type RateLimits = {
  aiRequestsPerMinute: number;
  researchRunsPerDay: number;
  memoGenerationsPerDay: number;
  ingestRunsPerDay: number;
};

export type FeatureFlags = {
  multiAgentResearch: boolean;
  knowledgeGraph: boolean;
  humanReviewWorkflow: boolean;
  nationwideIngestion: boolean;
  externalNotifications: boolean;
};

export type WorkspaceDeploymentConfig = {
  id: string;
  orgId: string;
  modelProvider: ModelProvider;
  modelName: string;
  modelSecretRef: string | null;
  embeddingProvider: EmbeddingProvider;
  embeddingModelName: string;
  embeddingSecretRef: string | null;
  retrievalDepth: number;
  confidenceThreshold: number;
  scoringWeights: ScoringWeights;
  promptTemplateSelection: PromptTemplateSelection;
  notificationRules: NotificationRule[];
  rateLimits: RateLimits;
  featureFlags: FeatureFlags;
  createdAt: string;
  updatedAt: string;
  updatedByUserId: string | null;
};

export type WorkspaceDeploymentConfigInput = Partial<
  Pick<
    WorkspaceDeploymentConfig,
    | "modelProvider"
    | "modelName"
    | "modelSecretRef"
    | "embeddingProvider"
    | "embeddingModelName"
    | "embeddingSecretRef"
    | "retrievalDepth"
    | "confidenceThreshold"
    | "scoringWeights"
    | "promptTemplateSelection"
    | "notificationRules"
    | "rateLimits"
    | "featureFlags"
  >
>;

export type WorkspaceDeploymentConfigHistory = {
  id: string;
  orgId: string;
  userId: string | null;
  changedAt: string;
  section: WorkspaceDeploymentSection;
  oldValue: unknown;
  newValue: unknown;
  metadata: Record<string, unknown>;
};
