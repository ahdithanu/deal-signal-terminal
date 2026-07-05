import type { CopilotRequest } from "@/types/copilot";

export type EvalWorkflow =
  | "copilot_answers"
  | "opportunity_memos"
  | "multi_agent_research"
  | "score_explanations";

export type EvalStatus = "running" | "passed" | "failed" | "error";

export type EvalRubric = {
  minScore: number;
  minCitationAccuracy: number;
  maxHallucinationRisk: number;
  minFactualCoverage: number;
  expectedIntent?: string;
  requireRefusal?: boolean;
  requiredPhrases?: string[];
};

export type EvalDataset = {
  id: string;
  name: string;
  description: string;
  workflow: EvalWorkflow;
  criticalThreshold: number;
  createdAt: string;
  updatedAt: string;
  cases: EvalCase[];
};

export type EvalCase = {
  id: string;
  datasetId: string;
  name: string;
  input: CopilotRequest & Record<string, unknown>;
  expectedOutput: Record<string, unknown>;
  retrievedContext: Record<string, unknown>;
  rubric: EvalRubric;
  createdAt: string;
  updatedAt: string;
};

export type EvalAssertion = {
  name: string;
  passed: boolean;
  detail: string;
};

export type EvalMetric = {
  id: string;
  resultId: string;
  metricName: "citation_accuracy" | "hallucination_risk" | "factual_coverage" | "overall_score";
  metricValue: number;
  threshold: number | null;
  passed: boolean;
  createdAt: string;
};

export type EvalResult = {
  id: string;
  runId: string;
  caseId: string;
  status: EvalStatus;
  score: number;
  expectedOutput: Record<string, unknown>;
  actualOutput: unknown;
  retrievedContext: Record<string, unknown>;
  citationAccuracy: number;
  hallucinationRisk: number;
  factualCoverage: number;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  assertions: EvalAssertion[];
  metrics: EvalMetric[];
  errorMessage: string | null;
  createdAt: string;
};

export type EvalRun = {
  id: string;
  datasetId: string;
  status: EvalStatus;
  promptVersion: string;
  model: string;
  startedAt: string;
  finishedAt: string | null;
  totalCases: number;
  passedCases: number;
  averageScore: number;
  gateThreshold: number;
  gatePassed: boolean;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalCostUsd: number;
  summary: Record<string, unknown>;
  results: EvalResult[];
};

export type EvalRunComparison = {
  leftRunId: string;
  rightRunId: string;
  scoreDelta: number;
  citationAccuracyDelta: number;
  hallucinationRiskDelta: number;
  factualCoverageDelta: number;
  regressionDetected: boolean;
};
