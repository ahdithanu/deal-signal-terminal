import type { Opportunity } from "@/types/domain";

export type ResearchAgentName =
  | "permit"
  | "property"
  | "company"
  | "risk"
  | "market"
  | "memo"
  | "coordinator";

export type ResearchAgentStatus = "succeeded" | "failed" | "skipped";

export type ResearchCitation = {
  id: string;
  label: string;
  url: string | null;
  recordId: string | null;
  excerpt: string;
  accessedAt: string;
};

export type AgentToolDefinition = {
  name: string;
  description: string;
  access: "read" | "write" | "none";
};

export type AgentMetric = {
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
};

export type AgentFinding = {
  title: string;
  detail: string;
  citations: ResearchCitation[];
  confidence: number;
};

export type BaseAgentOutput = {
  agentName: ResearchAgentName;
  summary: string;
  findings: AgentFinding[];
  citations: ResearchCitation[];
  confidence: number;
  assumptions: string[];
  missingData: string[];
};

export type PermitAgentInput = {
  opportunity: Opportunity;
};

export type PermitAgentOutput = BaseAgentOutput & {
  agentName: "permit";
  permitCount: number;
  permitPosture: string;
};

export type PropertyAgentInput = {
  opportunity: Opportunity;
};

export type PropertyAgentOutput = BaseAgentOutput & {
  agentName: "property";
  parcelStatus: string;
  ownerName: string | null;
};

export type CompanyAgentInput = {
  opportunity: Opportunity;
};

export type CompanyAgentOutput = BaseAgentOutput & {
  agentName: "company";
  companies: Array<{
    name: string;
    role: string;
    confidence: number;
  }>;
};

export type RiskAgentInput = {
  opportunity: Opportunity;
  permit: PermitAgentOutput | null;
  property: PropertyAgentOutput | null;
  company: CompanyAgentOutput | null;
};

export type RiskAgentOutput = BaseAgentOutput & {
  agentName: "risk";
  risks: Array<{
    risk: string;
    severity: "low" | "medium" | "high";
    mitigation: string;
  }>;
};

export type MarketAgentInput = {
  opportunity: Opportunity;
};

export type MarketAgentOutput = BaseAgentOutput & {
  agentName: "market";
  marketRead: string;
};

export type MemoAgentInput = {
  opportunity: Opportunity;
  specialistOutputs: SpecialistAgentOutput[];
};

export type MemoAgentOutput = BaseAgentOutput & {
  agentName: "memo";
  memo: string;
};

export type SpecialistAgentOutput =
  | PermitAgentOutput
  | PropertyAgentOutput
  | CompanyAgentOutput
  | RiskAgentOutput
  | MarketAgentOutput;

export type CoordinatorAgentInput = {
  opportunity: Opportunity;
};

export type CoordinatorAgentOutput = BaseAgentOutput & {
  agentName: "coordinator";
  finalMemo: string;
  conflictNotes: string[];
  specialistOutputs: Array<AgentRunResult<SpecialistAgentOutput | MemoAgentOutput>>;
};

export type AgentOutput =
  | SpecialistAgentOutput
  | MemoAgentOutput
  | CoordinatorAgentOutput;

export type AgentRunResult<TOutput extends AgentOutput = AgentOutput> = {
  agentName: ResearchAgentName;
  status: ResearchAgentStatus;
  model: string;
  promptVersion: string;
  startedAt: string;
  finishedAt: string;
  latencyMs: number;
  tokenUsage: AgentMetric;
  input: Record<string, unknown>;
  output: TOutput | null;
  error: string | null;
};

export type ResearchPacket = {
  runId: string;
  opportunityId: string;
  opportunitySlug: string;
  status: ResearchAgentStatus;
  model: string;
  promptVersion: string;
  startedAt: string;
  finishedAt: string;
  totalTokenUsage: AgentMetric;
  finalOutput: CoordinatorAgentOutput;
  outputs: AgentRunResult[];
};

export type ResearchAgentDefinition<TInput, TOutput extends AgentOutput> = {
  name: ResearchAgentName;
  promptVersion: string;
  promptTemplate: string;
  tools: AgentToolDefinition[];
  buildInput: (input: TInput) => Record<string, unknown>;
  execute: (input: TInput) => Promise<TOutput>;
  validateOutput: (output: unknown) => output is TOutput;
};
