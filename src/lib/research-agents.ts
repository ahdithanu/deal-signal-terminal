import { getOpenAIConfig } from "@/lib/env";
import { logError, logInfo } from "@/lib/observability";
import { createResearchRun, finishResearchRun, recordAgentOutput } from "@/lib/research-store";
import type { Opportunity, SourceEvidence } from "@/types/domain";
import type {
  AgentFinding,
  AgentRunResult,
  AgentToolDefinition,
  BaseAgentOutput,
  CompanyAgentInput,
  CompanyAgentOutput,
  CoordinatorAgentInput,
  CoordinatorAgentOutput,
  MarketAgentInput,
  MarketAgentOutput,
  MemoAgentInput,
  MemoAgentOutput,
  PermitAgentInput,
  PermitAgentOutput,
  PropertyAgentInput,
  PropertyAgentOutput,
  ResearchAgentDefinition,
  ResearchAgentName,
  ResearchCitation,
  ResearchPacket,
  RiskAgentInput,
  RiskAgentOutput,
  SpecialistAgentOutput,
} from "@/types/research";

export const RESEARCH_PROMPT_VERSION = "multi-agent-research-v1";

const READ_ONLY_TOOLS: AgentToolDefinition[] = [
  {
    name: "opportunity_record",
    description: "Read the normalized Build Signals opportunity object and source evidence.",
    access: "read",
  },
  {
    name: "knowledge_graph_context",
    description: "Read known entity and relationship context attached to the opportunity.",
    access: "read",
  },
];

function citationFromEvidence(evidence: SourceEvidence): ResearchCitation {
  return {
    id: evidence.id,
    label: evidence.label,
    url: evidence.url || evidence.pageUrl || null,
    recordId: evidence.recordId,
    excerpt: evidence.excerpt,
    accessedAt: evidence.accessedAt,
  };
}

function uniqueCitations(opportunity: Opportunity): ResearchCitation[] {
  const seen = new Set<string>();
  const citations: ResearchCitation[] = [];

  for (const evidence of opportunity.evidence) {
    if (seen.has(evidence.id)) {
      continue;
    }

    citations.push(citationFromEvidence(evidence));
    seen.add(evidence.id);
  }

  return citations;
}

function baseOutput(
  agentName: ResearchAgentName,
  opportunity: Opportunity,
  input: {
    summary: string;
    findings: AgentFinding[];
    confidence: number;
    assumptions?: string[];
    missingData?: string[];
  }
): BaseAgentOutput {
  return {
    agentName,
    summary: input.summary,
    findings: input.findings,
    citations: uniqueCitations(opportunity),
    confidence: input.confidence,
    assumptions: input.assumptions ?? [
      "Analysis is constrained to normalized Build Signals records and attached source excerpts.",
    ],
    missingData: input.missingData ?? opportunity.missingFacts,
  };
}

function estimateTokens(payload: unknown) {
  return Math.max(1, Math.ceil(JSON.stringify(payload).length / 4));
}

function agentFailureOutput(agentName: ResearchAgentName, opportunity: Opportunity, error: unknown) {
  return baseOutput(agentName, opportunity, {
    summary: `${agentName} agent failed; coordinator continued with available source-backed outputs.`,
    findings: [],
    confidence: 0,
    assumptions: [],
    missingData: [
      error instanceof Error ? error.message : "Agent failed for an unknown reason.",
      ...opportunity.missingFacts,
    ],
  });
}

function validateBaseOutput(agentName: ResearchAgentName, output: unknown): output is BaseAgentOutput {
  const candidate = output as BaseAgentOutput;
  return (
    candidate?.agentName === agentName &&
    typeof candidate.summary === "string" &&
    Array.isArray(candidate.findings) &&
    Array.isArray(candidate.citations) &&
    typeof candidate.confidence === "number" &&
    Array.isArray(candidate.assumptions) &&
    Array.isArray(candidate.missingData)
  );
}

export const permitAgent: ResearchAgentDefinition<PermitAgentInput, PermitAgentOutput> = {
  name: "permit",
  promptVersion: RESEARCH_PROMPT_VERSION,
  promptTemplate:
    "Analyze permit chronology, permit scope, signal strength, and evidence gaps. Return structured findings with citations only from supplied records.",
  tools: READ_ONLY_TOOLS,
  buildInput: ({ opportunity }) => ({
    opportunityId: opportunity.id,
    signals: opportunity.signals,
    evidence: opportunity.evidence,
  }),
  async execute({ opportunity }) {
    const citations = uniqueCitations(opportunity);
    const permitTypes = Array.from(new Set(opportunity.signals.map((signal) => signal.permitType)));
    const findings = opportunity.signals.map((signal): AgentFinding => ({
      title: `${signal.permitNumber} ${signal.permitType}`,
      detail: `${signal.status} ${signal.permitSubtype} at ${signal.siteAddress}; latest visible date ${signal.issuedDate ?? signal.approvedDate ?? signal.appliedDate}.`,
      citations: [citationFromEvidence(signal.source)],
      confidence: signal.siteAddress === "Address pending" ? 0.68 : 0.88,
    }));

    return {
      ...baseOutput("permit", opportunity, {
        summary: `${opportunity.signals.length} permit signal${opportunity.signals.length === 1 ? "" : "s"} support this opportunity: ${permitTypes.join(", ")}.`,
        findings,
        confidence: Math.min(0.95, 0.72 + opportunity.signals.length * 0.06),
        missingData: opportunity.missingFacts.filter((fact) => /permit|scope|program|timing/i.test(fact)),
      }),
      agentName: "permit",
      permitCount: opportunity.signals.length,
      permitPosture: findings.length > 1 ? "clustered_signal" : "single_signal",
      citations,
    };
  },
  validateOutput(output): output is PermitAgentOutput {
    return validateBaseOutput("permit", output) && typeof (output as PermitAgentOutput).permitCount === "number";
  },
};

export const propertyAgent: ResearchAgentDefinition<PropertyAgentInput, PropertyAgentOutput> = {
  name: "property",
  promptVersion: RESEARCH_PROMPT_VERSION,
  promptTemplate:
    "Analyze parcel, property, ownership, zoning, and site context. Do not infer missing ownership or entitlement facts.",
  tools: READ_ONLY_TOOLS,
  buildInput: ({ opportunity }) => ({
    parcelContext: opportunity.parcelContext,
    location: opportunity.locationLabel,
  }),
  async execute({ opportunity }) {
    const parcel = opportunity.parcelContext;
    const findings: AgentFinding[] = [
      {
        title: "Parcel context",
        detail: `${parcel.status} parcel context for APN ${parcel.apn}; owner ${parcel.ownerName ?? "not confirmed"}; zoning ${parcel.zoning ?? "missing"}.`,
        citations: uniqueCitations(opportunity),
        confidence: parcel.status === "missing" ? 0.42 : parcel.status === "partial" ? 0.7 : 0.86,
      },
    ];

    return {
      ...baseOutput("property", opportunity, {
        summary: `Property read is ${parcel.status}; APN ${parcel.apn} has ${parcel.ownerName ? "owner context" : "no confirmed owner context"} and ${parcel.zoning ? "zoning context" : "missing zoning"}.`,
        findings,
        confidence: parcel.status === "missing" ? 0.42 : parcel.status === "partial" ? 0.7 : 0.86,
        missingData: [
          ...(parcel.ownerName ? [] : ["Confirmed owner"]),
          ...(parcel.zoning ? [] : ["Current zoning"]),
          ...(parcel.lastTransferDate ? [] : ["Recent transfer history"]),
        ],
      }),
      agentName: "property",
      parcelStatus: parcel.status,
      ownerName: parcel.ownerName,
    };
  },
  validateOutput(output): output is PropertyAgentOutput {
    return validateBaseOutput("property", output) && typeof (output as PropertyAgentOutput).parcelStatus === "string";
  },
};

export const companyAgent: ResearchAgentDefinition<CompanyAgentInput, CompanyAgentOutput> = {
  name: "company",
  promptVersion: RESEARCH_PROMPT_VERSION,
  promptTemplate:
    "Identify companies and roles explicitly present in source data. Never invent developers, tenants, lenders, or brokers.",
  tools: READ_ONLY_TOOLS,
  buildInput: ({ opportunity }) => ({
    ownerName: opportunity.parcelContext.ownerName,
    contractors: opportunity.signals.map((signal) => signal.contractorName),
  }),
  async execute({ opportunity }) {
    const companies = [
      opportunity.parcelContext.ownerName
        ? {
            name: opportunity.parcelContext.ownerName,
            role: "owner",
            confidence: opportunity.parcelContext.status === "missing" ? 0.45 : 0.8,
          }
        : null,
      ...opportunity.signals
        .filter((signal) => signal.contractorName)
        .map((signal) => ({
          name: signal.contractorName as string,
          role: "general_contractor",
          confidence: 0.74,
        })),
    ].filter((company): company is { name: string; role: string; confidence: number } =>
      Boolean(company)
    );

    return {
      ...baseOutput("company", opportunity, {
        summary: companies.length
          ? `${companies.length} explicit company/party reference${companies.length === 1 ? "" : "s"} found in the current record.`
          : "No developer, contractor, lender, broker, architect, or engineer is explicitly resolved from current records.",
        findings: companies.map((company) => ({
          title: company.name,
          detail: `${company.name} appears as ${company.role}; confidence ${Math.round(company.confidence * 100)}%.`,
          citations: uniqueCitations(opportunity),
          confidence: company.confidence,
        })),
        confidence: companies.length ? Math.max(...companies.map((company) => company.confidence)) : 0.35,
        missingData: [
          "Confirmed developer or sponsor",
          "Architect and engineer of record",
          "Debt provider or lender",
          "Broker or leasing team",
        ],
      }),
      agentName: "company",
      companies,
    };
  },
  validateOutput(output): output is CompanyAgentOutput {
    return validateBaseOutput("company", output) && Array.isArray((output as CompanyAgentOutput).companies);
  },
};

export const marketAgent: ResearchAgentDefinition<MarketAgentInput, MarketAgentOutput> = {
  name: "market",
  promptVersion: RESEARCH_PROMPT_VERSION,
  promptTemplate:
    "Analyze market context using only opportunity scoring metadata, city tier, and local signal context.",
  tools: READ_ONLY_TOOLS,
  buildInput: ({ opportunity }) => ({
    marketId: opportunity.marketId,
    location: opportunity.locationLabel,
    priorityScore: opportunity.priorityScore,
    localContext: opportunity.localContext,
  }),
  async execute({ opportunity }) {
    const marketRead = `${opportunity.locationLabel} is classified as ${opportunity.localContext.replace(/_/g, " ")} with a ${opportunity.priorityBand} priority band and ${opportunity.confidenceLevel} confidence.`;

    return {
      ...baseOutput("market", opportunity, {
        summary: marketRead,
        findings: [
          {
            title: "Market posture",
            detail: `${opportunity.metadata.corridorTier} corridor, ${opportunity.priorityScore} priority score, ${opportunity.metadata.capitalProfile} capital profile.`,
            citations: uniqueCitations(opportunity),
            confidence: 0.76,
          },
        ],
        confidence: 0.76,
        missingData: ["Comparable transactions", "Current rent/sale comps", "Active capital markets feedback"],
      }),
      agentName: "market",
      marketRead,
    };
  },
  validateOutput(output): output is MarketAgentOutput {
    return validateBaseOutput("market", output) && typeof (output as MarketAgentOutput).marketRead === "string";
  },
};

export const riskAgent: ResearchAgentDefinition<RiskAgentInput, RiskAgentOutput> = {
  name: "risk",
  promptVersion: RESEARCH_PROMPT_VERSION,
  promptTemplate:
    "Identify diligence risks, severity, and mitigations from specialist outputs. Prefer explicit missing-data risks over speculation.",
  tools: READ_ONLY_TOOLS,
  buildInput: ({ opportunity, permit, property, company }) => ({
    opportunityId: opportunity.id,
    permitSummary: permit?.summary,
    propertySummary: property?.summary,
    companySummary: company?.summary,
  }),
  async execute({ opportunity, permit, property, company }) {
    const risks: RiskAgentOutput["risks"] = [
      {
        risk: "Ownership and site-control uncertainty",
        severity: property?.ownerName ? "medium" : "high",
        mitigation: "Verify owner, transfer history, and site-control status before outreach or underwriting.",
      },
      {
        risk: "Permit signal may not equal active transaction intent",
        severity: permit && permit.permitCount > 1 ? "medium" : "high",
        mitigation: "Check related permits, entitlement files, and direct sponsor/owner confirmation.",
      },
      {
        risk: "Counterparty coverage is incomplete",
        severity: company && company.companies.length ? "medium" : "high",
        mitigation: "Resolve developer, architect, engineer, lender, and broker parties before sales motion.",
      },
    ];

    return {
      ...baseOutput("risk", opportunity, {
        summary: `${risks.filter((risk) => risk.severity === "high").length} high-severity diligence risk${risks.filter((risk) => risk.severity === "high").length === 1 ? "" : "s"} remain before this can be treated as enterprise-grade account intelligence.`,
        findings: risks.map((risk) => ({
          title: risk.risk,
          detail: `${risk.severity.toUpperCase()}: ${risk.mitigation}`,
          citations: uniqueCitations(opportunity),
          confidence: risk.severity === "high" ? 0.82 : 0.68,
        })),
        confidence: 0.78,
        missingData: opportunity.missingFacts,
      }),
      agentName: "risk",
      risks,
    };
  },
  validateOutput(output): output is RiskAgentOutput {
    return validateBaseOutput("risk", output) && Array.isArray((output as RiskAgentOutput).risks);
  },
};

export const memoAgent: ResearchAgentDefinition<MemoAgentInput, MemoAgentOutput> = {
  name: "memo",
  promptVersion: RESEARCH_PROMPT_VERSION,
  promptTemplate:
    "Synthesize specialist outputs into an executive memo with citations, confidence, assumptions, and missing data.",
  tools: READ_ONLY_TOOLS,
  buildInput: ({ opportunity, specialistOutputs }) => ({
    opportunityId: opportunity.id,
    specialistSummaries: specialistOutputs.map((output) => ({
      agentName: output.agentName,
      summary: output.summary,
      confidence: output.confidence,
    })),
  }),
  async execute({ opportunity, specialistOutputs }) {
    const memo = [
      `Opportunity: ${opportunity.projectName ?? opportunity.title}`,
      "",
      "Executive read",
      specialistOutputs.map((output) => `- ${output.agentName}: ${output.summary}`).join("\n"),
      "",
      "Recommended next step",
      opportunity.nextStep,
      "",
      "Missing data",
      Array.from(new Set(specialistOutputs.flatMap((output) => output.missingData)))
        .slice(0, 8)
        .map((item) => `- ${item}`)
        .join("\n"),
    ].join("\n");
    const confidence =
      specialistOutputs.reduce((sum, output) => sum + output.confidence, 0) /
      Math.max(1, specialistOutputs.length);

    return {
      ...baseOutput("memo", opportunity, {
        summary: "Synthesized specialist outputs into a source-constrained executive memo.",
        findings: specialistOutputs.flatMap((output) => output.findings).slice(0, 8),
        confidence,
        missingData: Array.from(new Set(specialistOutputs.flatMap((output) => output.missingData))),
      }),
      agentName: "memo",
      memo,
    };
  },
  validateOutput(output): output is MemoAgentOutput {
    return validateBaseOutput("memo", output) && typeof (output as MemoAgentOutput).memo === "string";
  },
};

async function runAgent<TInput, TOutput extends SpecialistAgentOutput | MemoAgentOutput | CoordinatorAgentOutput>(
  agent: ResearchAgentDefinition<TInput, TOutput>,
  input: TInput,
  model: string
): Promise<AgentRunResult<TOutput>> {
  const startedAt = new Date().toISOString();
  const start = Date.now();
  const serializedInput = agent.buildInput(input);

  logInfo("Research agent started", { agent: agent.name, promptVersion: agent.promptVersion });

  try {
    const output = await agent.execute(input);

    if (!agent.validateOutput(output)) {
      throw new Error(`${agent.name} agent returned invalid structured output.`);
    }

    const finishedAt = new Date().toISOString();
    const latencyMs = Date.now() - start;
    logInfo("Research agent completed", { agent: agent.name, latencyMs });

    return {
      agentName: agent.name,
      status: "succeeded",
      model,
      promptVersion: agent.promptVersion,
      startedAt,
      finishedAt,
      latencyMs,
      tokenUsage: {
        promptTokens: estimateTokens(serializedInput),
        completionTokens: estimateTokens(output),
        latencyMs,
      },
      input: serializedInput,
      output,
      error: null,
    };
  } catch (error) {
    const finishedAt = new Date().toISOString();
    const latencyMs = Date.now() - start;
    logError("Research agent failed", error, { agent: agent.name });

    return {
      agentName: agent.name,
      status: "failed",
      model,
      promptVersion: agent.promptVersion,
      startedAt,
      finishedAt,
      latencyMs,
      tokenUsage: {
        promptTokens: estimateTokens(serializedInput),
        completionTokens: 0,
        latencyMs,
      },
      input: serializedInput,
      output: agentFailureOutput(agent.name, (input as { opportunity: Opportunity }).opportunity, error) as TOutput,
      error: error instanceof Error ? error.message : "Unknown agent error",
    };
  }
}

function conflictNotes(outputs: SpecialistAgentOutput[]) {
  const notes: string[] = [];
  const property = outputs.find((output): output is PropertyAgentOutput => output.agentName === "property");
  const company = outputs.find((output): output is CompanyAgentOutput => output.agentName === "company");

  if (property?.ownerName && company && !company.companies.some((companyEntry) => companyEntry.name === property.ownerName)) {
    notes.push("Property agent resolved an owner that company agent did not classify as a company party.");
  }

  if (outputs.some((output) => output.confidence < 0.5)) {
    notes.push("At least one specialist returned low confidence; final memo should preserve missing-data language.");
  }

  return notes;
}

export async function runMultiAgentResearch(
  input: CoordinatorAgentInput,
  options: { forceAgentFailure?: ResearchAgentName } = {}
): Promise<ResearchPacket> {
  const openAI = getOpenAIConfig();
  const model = openAI.model;
  const startedAt = new Date().toISOString();
  const runId = await createResearchRun({
    opportunityId: input.opportunity.id,
    opportunitySlug: input.opportunity.slug,
    model,
    promptVersion: RESEARCH_PROMPT_VERSION,
    startedAt,
  });

  const permit = await runAgent(permitAgent, input, model);
  if (options.forceAgentFailure === "permit") {
    permit.status = "failed";
    permit.error = "Forced agent failure for recovery validation.";
  }
  await recordAgentOutput(runId, permit);

  const property = await runAgent(propertyAgent, input, model);
  if (options.forceAgentFailure === "property") {
    property.status = "failed";
    property.error = "Forced agent failure for recovery validation.";
  }
  await recordAgentOutput(runId, property);

  const company = await runAgent(companyAgent, input, model);
  if (options.forceAgentFailure === "company") {
    company.status = "failed";
    company.error = "Forced agent failure for recovery validation.";
  }
  await recordAgentOutput(runId, company);

  const successfulCoreOutputs = [permit, property, company]
    .filter((result) => result.output)
    .map((result) => result.output as PermitAgentOutput | PropertyAgentOutput | CompanyAgentOutput);

  const risk = await runAgent(
    riskAgent,
    {
      opportunity: input.opportunity,
      permit: permit.status === "succeeded" ? (permit.output as PermitAgentOutput) : null,
      property: property.status === "succeeded" ? (property.output as PropertyAgentOutput) : null,
      company: company.status === "succeeded" ? (company.output as CompanyAgentOutput) : null,
    },
    model
  );
  await recordAgentOutput(runId, risk);

  const market = await runAgent(marketAgent, input, model);
  await recordAgentOutput(runId, market);

  const specialistOutputs = [
    ...successfulCoreOutputs,
    ...(risk.output ? [risk.output as RiskAgentOutput] : []),
    ...(market.output ? [market.output as MarketAgentOutput] : []),
  ];
  const memo = await runAgent(memoAgent, { opportunity: input.opportunity, specialistOutputs }, model);
  await recordAgentOutput(runId, memo);

  const failedAgents = [permit, property, company, risk, market, memo].filter(
    (result) => result.status === "failed"
  );
  const finalMemo =
    (memo.output as MemoAgentOutput | null)?.memo ??
    `Research completed with partial coverage for ${input.opportunity.projectName ?? input.opportunity.title}.`;
  const coordinatorOutput: CoordinatorAgentOutput = {
    agentName: "coordinator",
    summary:
      failedAgents.length > 0
        ? `Coordinator synthesized partial research with ${failedAgents.length} failed agent${failedAgents.length === 1 ? "" : "s"}.`
        : "Coordinator synthesized specialist research into a final evidence-backed packet.",
    findings: specialistOutputs.flatMap((output) => output.findings).slice(0, 12),
    citations: uniqueCitations(input.opportunity),
    confidence:
      specialistOutputs.reduce((sum, output) => sum + output.confidence, 0) /
      Math.max(1, specialistOutputs.length),
    assumptions: [
      "Specialist agents used only normalized Build Signals records and attached citations.",
      "Coordinator preserved missing-data warnings rather than filling gaps.",
    ],
    missingData: Array.from(new Set(specialistOutputs.flatMap((output) => output.missingData))),
    finalMemo,
    conflictNotes: conflictNotes(specialistOutputs),
    specialistOutputs: [permit, property, company, risk, market, memo],
  };

  const finishedAt = new Date().toISOString();
  const allResults = [permit, property, company, risk, market, memo];
  const totalTokenUsage = allResults.reduce(
    (total, result) => ({
      promptTokens: total.promptTokens + result.tokenUsage.promptTokens,
      completionTokens: total.completionTokens + result.tokenUsage.completionTokens,
      latencyMs: total.latencyMs + result.latencyMs,
    }),
    { promptTokens: 0, completionTokens: 0, latencyMs: 0 }
  );
  const packet: ResearchPacket = {
    runId,
    opportunityId: input.opportunity.id,
    opportunitySlug: input.opportunity.slug,
    status: failedAgents.length ? "failed" : "succeeded",
    model,
    promptVersion: RESEARCH_PROMPT_VERSION,
    startedAt,
    finishedAt,
    totalTokenUsage,
    finalOutput: coordinatorOutput,
    outputs: [
      ...allResults,
      {
        agentName: "coordinator",
        status: "succeeded",
        model,
        promptVersion: RESEARCH_PROMPT_VERSION,
        startedAt,
        finishedAt,
        latencyMs: Date.parse(finishedAt) - Date.parse(startedAt),
        tokenUsage: {
          promptTokens: estimateTokens({ opportunityId: input.opportunity.id }),
          completionTokens: estimateTokens(coordinatorOutput),
          latencyMs: Date.parse(finishedAt) - Date.parse(startedAt),
        },
        input: { opportunityId: input.opportunity.id, failedAgents: failedAgents.map((agent) => agent.agentName) },
        output: coordinatorOutput,
        error: null,
      },
    ],
  };

  await recordAgentOutput(runId, packet.outputs[packet.outputs.length - 1]);
  await finishResearchRun(packet, failedAgents.map((agent) => agent.error).filter(Boolean).join("; ") || null);

  return packet;
}

export const researchAgents = [
  permitAgent,
  propertyAgent,
  companyAgent,
  riskAgent,
  marketAgent,
  memoAgent,
] as const;
