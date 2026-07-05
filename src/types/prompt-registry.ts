export type PromptWorkflow =
  | "copilot_answers"
  | "opportunity_memos"
  | "multi_agent_research"
  | "score_explanations";

export type PromptTemplateStatus = "active" | "archived";

export type PromptVersionStatus = "draft" | "active" | "archived";

export type PromptVersion = {
  id: string;
  templateId: string;
  version: string;
  status: PromptVersionStatus;
  promptBody: string;
  variables: string[];
  outputSchema: Record<string, unknown>;
  modelFamily: string;
  changelog: string;
  createdByUserId: string | null;
  createdAt: string;
  activatedAt: string | null;
};

export type PromptTemplate = {
  id: string;
  promptKey: string;
  name: string;
  description: string;
  workflow: PromptWorkflow;
  status: PromptTemplateStatus;
  activeVersionId: string | null;
  createdAt: string;
  updatedAt: string;
  activeVersion: PromptVersion | null;
  versions: PromptVersion[];
};

export type PromptRegistryEvent = {
  id: string;
  templateId: string;
  versionId: string | null;
  userId: string | null;
  action: string;
  occurredAt: string;
  metadata: Record<string, unknown>;
};

export type CreatePromptVersionInput = {
  promptKey: string;
  version: string;
  promptBody: string;
  variables: string[];
  outputSchema: Record<string, unknown>;
  modelFamily: string;
  changelog: string;
  createdByUserId?: string | null;
};
