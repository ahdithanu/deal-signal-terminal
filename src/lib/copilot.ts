import { randomUUID } from "node:crypto";

import { buildOpportunitySummary, generateOpportunityMemo } from "@/lib/ai";
import { getDatabase, resolveDatabaseProvider } from "@/lib/db";
import { getOpenAIConfig } from "@/lib/env";
import { formatOpportunityType } from "@/lib/formatters";
import { buildOpportunityGraphContext } from "@/lib/opportunity-graph";
import { getOpportunities, getOpportunityBySlugWithGenerated } from "@/lib/opportunity-service";
import { queryPostgres } from "@/lib/postgres";
import type { CopilotCitation, CopilotIntent, CopilotRequest, CopilotResponse } from "@/types/copilot";
import type { Opportunity } from "@/types/domain";

function citationFromOpportunity(opportunity: Opportunity): CopilotCitation {
  return {
    id: `opportunity:${opportunity.id}`,
    label: opportunity.projectName ?? opportunity.title,
    sourceType: "opportunity",
    url: `/opportunity/${opportunity.slug}`,
    recordId: opportunity.id,
    excerpt: `${opportunity.thesis} Next step: ${opportunity.nextStep}`,
  };
}

function citationFromScore(opportunity: Opportunity): CopilotCitation {
  return {
    id: `score:${opportunity.id}`,
    label: `${opportunity.projectName ?? opportunity.title} score`,
    sourceType: "score",
    url: `/opportunity/${opportunity.slug}`,
    recordId: opportunity.id,
    excerpt: opportunity.scoreBreakdown
      .map((dimension) => `${dimension.label}: ${dimension.score}/${dimension.maxScore} - ${dimension.reason}`)
      .join(" "),
  };
}

function citationFromSource(opportunity: Opportunity, index: number): CopilotCitation {
  const evidence = opportunity.evidence[index] ?? opportunity.evidence[0];

  return {
    id: `source:${opportunity.id}:${evidence?.id ?? index}`,
    label: evidence?.label ?? `${opportunity.projectName ?? opportunity.title} source`,
    sourceType: "source_evidence",
    url: evidence?.pageUrl ?? evidence?.url ?? null,
    recordId: evidence?.recordId ?? null,
    excerpt: evidence?.excerpt ?? opportunity.whyItMatters,
  };
}

function citationFromParcel(opportunity: Opportunity): CopilotCitation {
  const parcel = opportunity.parcelContext;

  return {
    id: `parcel:${opportunity.id}`,
    label: `${parcel.apn} parcel context`,
    sourceType: "parcel",
    url: null,
    recordId: parcel.apn,
    excerpt:
      parcel.status === "missing"
        ? "Parcel context is missing for this opportunity."
        : `Parcel context from ${parcel.sourceLabel} as of ${parcel.sourceAsOf}: owner ${parcel.ownerName ?? "missing"}, zoning ${parcel.zoning ?? "missing"}, land use ${parcel.landUse ?? "missing"}.`,
  };
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function routeCopilotIntent(question: string, explicitIntent?: CopilotIntent): CopilotIntent {
  if (explicitIntent) {
    return explicitIntent;
  }

  const normalized = normalize(question);

  if (/\bcompare|versus| vs \b|better than/.test(normalized)) {
    return "compare_opportunities";
  }

  if (/\bscore|scored|priority|ranking|ranked\b/.test(normalized)) {
    return "explain_score";
  }

  if (/\bmemo|ic memo|investment committee|writeup|write up\b/.test(normalized)) {
    return "generate_executive_memo";
  }

  if (/\bnext|action|do now|follow up|recommend\b/.test(normalized)) {
    return "recommend_next_action";
  }

  if (/\bsummary|summarize|what is this|overview\b/.test(normalized)) {
    return "summarize_opportunity";
  }

  if (/\bsearch|find|show|list|which opportunities\b/.test(normalized)) {
    return "search_opportunities";
  }

  return "answer_question_with_citations";
}

function scoreMatch(opportunity: Opportunity, query: string) {
  const haystack = normalize(
    [
      opportunity.title,
      opportunity.projectName,
      opportunity.locationLabel,
      opportunity.opportunityType,
      opportunity.developmentStage,
      opportunity.whyItMatters,
      opportunity.thesis,
      opportunity.nextStep,
      ...opportunity.tags,
      ...opportunity.signals.map((signal) => `${signal.permitNumber} ${signal.description} ${signal.siteCity}`),
    ]
      .filter(Boolean)
      .join(" ")
  );
  const terms = normalize(query).split(/\s+/).filter((term) => term.length > 2);

  return terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
}

async function resolveOpportunities(request: CopilotRequest) {
  const all = await getOpportunities();
  const selected = new Map<string, Opportunity>();

  for (const slug of [
    request.opportunitySlug,
    ...(request.compareSlugs ?? []),
    ...(request.visibleOpportunitySlugs ?? []),
  ].filter((slug): slug is string => Boolean(slug))) {
    const opportunity =
      all.find((candidate) => candidate.slug === slug) ??
      (await getOpportunityBySlugWithGenerated(slug));

    if (opportunity) {
      selected.set(opportunity.slug, opportunity);
    }
  }

  if (selected.size === 0) {
    for (const opportunity of [...all]
      .map((opportunity) => ({ opportunity, score: scoreMatch(opportunity, request.question) }))
      .sort((left, right) => right.score - left.score || right.opportunity.priorityScore - left.opportunity.priorityScore)
      .slice(0, 5)
      .map((match) => match.opportunity)) {
      selected.set(opportunity.slug, opportunity);
    }
  }

  return Array.from(selected.values()).slice(0, 8);
}

async function retrieveContext(opportunities: Opportunity[]) {
  const graphRelationships: CopilotCitation[] = [];

  for (const opportunity of opportunities.slice(0, 3)) {
    try {
      const graph = await buildOpportunityGraphContext(opportunity);
      for (const relationship of graph.relationships.slice(0, 3)) {
        const from = graph.entities.find((entity) => entity.id === relationship.fromEntityId);
        const to = graph.entities.find((entity) => entity.id === relationship.toEntityId);
        graphRelationships.push({
          id: `graph:${relationship.id}`,
          label: `${from?.displayName ?? "Entity"} ${relationship.relationshipType} ${to?.displayName ?? "entity"}`,
          sourceType: "graph_relationship",
          url: `/opportunity/${opportunity.slug}`,
          recordId: relationship.sourceId,
          excerpt:
            relationship.evidence[0]?.excerpt ??
            `Relationship confidence ${relationship.confidence}. Provenance: ${JSON.stringify(relationship.provenance)}`,
        });
      }
    } catch {
      // Graph context is additive. The Copilot can still answer from opportunity and source evidence.
    }
  }

  return {
    opportunities: opportunities.map((opportunity) => ({
      id: opportunity.id,
      slug: opportunity.slug,
      title: opportunity.projectName ?? opportunity.title,
      score: opportunity.priorityScore,
      confidence: opportunity.confidenceLevel,
      citedFacts: [
        citationFromOpportunity(opportunity),
        citationFromScore(opportunity),
        citationFromSource(opportunity, 0),
        citationFromParcel(opportunity),
      ],
    })),
    graphRelationships,
    memoContext: opportunities.map((opportunity) => ({
      id: `memo:${opportunity.id}`,
      label: `${opportunity.projectName ?? opportunity.title} memo-ready summary`,
      sourceType: "memo" as const,
      url: `/memo/${opportunity.slug}`,
      recordId: opportunity.id,
      excerpt: buildOpportunitySummary(opportunity),
    })),
  };
}

function allCitations(context: Awaited<ReturnType<typeof retrieveContext>>) {
  const citations = [
    ...context.opportunities.flatMap((opportunity) => opportunity.citedFacts),
    ...context.graphRelationships,
    ...context.memoContext,
  ];
  const seen = new Set<string>();

  return citations.filter((citation) => {
    if (seen.has(citation.id)) {
      return false;
    }

    seen.add(citation.id);
    return Boolean(citation.excerpt.trim());
  });
}

function missingEvidenceResponse(
  id: string,
  intent: CopilotIntent,
  context: Awaited<ReturnType<typeof retrieveContext>>
): CopilotResponse {
  return {
    id,
    intent,
    directAnswer:
      "I do not have enough cited Build Signals evidence to answer that without inventing facts. Try asking about a ranked opportunity, its score, source record, parcel context, or next action.",
    citations: [],
    confidence: "low",
    assumptions: ["No sufficiently relevant opportunity or source evidence was retrieved."],
    suggestedNextActions: [
      "Search for a specific project, permit number, city, owner, or opportunity type.",
      "Open a ranked opportunity and ask the Copilot from that detail page.",
    ],
    retrievedContext: context,
    refused: true,
  };
}

function answerSearch(opportunities: Opportunity[]) {
  const top = opportunities.slice(0, 5);

  return `The strongest matches are ${top
    .map((opportunity) => `${opportunity.projectName ?? opportunity.title} (${opportunity.priorityScore}, ${formatOpportunityType(opportunity.opportunityType)})`)
    .join(", ")}.`;
}

function answerExplainScore(opportunity: Opportunity) {
  const strongest = [...opportunity.scoreBreakdown].sort((left, right) => right.score - left.score)[0];
  const weakest = [...opportunity.scoreBreakdown].sort((left, right) => left.score - right.score)[0];

  return `${opportunity.projectName ?? opportunity.title} scores ${opportunity.priorityScore} because ${strongest?.label.toLowerCase()} is the strongest contributor (${strongest?.score}/${strongest?.maxScore}) while ${weakest?.label.toLowerCase()} is the main limiter (${weakest?.score}/${weakest?.maxScore}). The ranking is supported by ${opportunity.signals.length} permit signal(s), ${opportunity.confidenceLevel} confidence, and ${opportunity.parcelContext.status} parcel context.`;
}

function answerCompare(opportunities: Opportunity[]) {
  const ranked = [...opportunities].sort((left, right) => right.priorityScore - left.priorityScore).slice(0, 4);
  const winner = ranked[0];

  return `${winner.projectName ?? winner.title} is the strongest of this comparison at ${winner.priorityScore}. ${ranked
    .map((opportunity) => `${opportunity.projectName ?? opportunity.title}: ${opportunity.priorityScore}, ${formatOpportunityType(opportunity.opportunityType)}, ${opportunity.confidenceLevel} confidence`)
    .join("; ")}.`;
}

async function buildDirectAnswer(intent: CopilotIntent, opportunities: Opportunity[]) {
  const primary = opportunities[0];

  if (intent === "search_opportunities") {
    return answerSearch(opportunities);
  }

  if (intent === "explain_score" && primary) {
    return answerExplainScore(primary);
  }

  if (intent === "compare_opportunities") {
    return answerCompare(opportunities);
  }

  if (intent === "generate_executive_memo" && primary) {
    const memo = await generateOpportunityMemo(primary);
    return memo.body;
  }

  if (intent === "recommend_next_action" && primary) {
    return `Recommended next action: ${primary.nextStep} The main reason to act is: ${primary.whyItMatters}`;
  }

  if (intent === "summarize_opportunity" && primary) {
    return buildOpportunitySummary(primary);
  }

  return primary
    ? `${primary.projectName ?? primary.title} matters because ${primary.whyItMatters} The next action is: ${primary.nextStep}`
    : "";
}

function confidenceFor(opportunities: Opportunity[]) {
  if (!opportunities.length) {
    return "low" as const;
  }

  if (opportunities.some((opportunity) => opportunity.confidenceLevel === "low")) {
    return "medium" as const;
  }

  return opportunities[0]?.confidenceLevel ?? "medium";
}

function suggestedActions(intent: CopilotIntent, opportunities: Opportunity[]) {
  const primary = opportunities[0];

  if (!primary) {
    return ["Widen the search or ask about a named opportunity."];
  }

  const base = [
    primary.nextStep,
    `Open the source record for ${primary.signals[0]?.permitNumber ?? primary.title}.`,
    `Review missing facts: ${primary.missingFacts.join(", ") || "none flagged"}.`,
  ];

  if (intent === "compare_opportunities") {
    base.unshift("Prioritize the highest-scoring opportunity, then use confidence and missing facts as the tiebreaker.");
  }

  if (intent === "generate_executive_memo") {
    base.unshift("Submit the memo draft to human review before sharing externally.");
  }

  return base.slice(0, 4);
}

async function logCopilotRun(input: {
  orgId?: string | null;
  userId?: string | null;
  query: string;
  intent: CopilotIntent;
  retrievedContext: unknown;
  response: unknown;
  latencyMs: number;
  errorMessage?: string | null;
}) {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const openAI = getOpenAIConfig();
  const values = [
    id,
    input.orgId ?? null,
    input.userId ?? null,
    input.query,
    input.intent,
    JSON.stringify(input.retrievedContext),
    JSON.stringify(input.response),
    openAI.model,
    0,
    0,
    input.latencyMs,
    input.errorMessage ?? null,
    createdAt,
  ];

  if (resolveDatabaseProvider() === "postgres") {
    await queryPostgres(
      `INSERT INTO copilot_runs (
        id, org_id, user_id, query, intent, retrieved_context_json, response_json, model,
        prompt_tokens, completion_tokens, latency_ms, error_message, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      values
    );
    return;
  }

  getDatabase()
    .prepare(
      `INSERT INTO copilot_runs (
        id, org_id, user_id, query, intent, retrieved_context_json, response_json, model,
        prompt_tokens, completion_tokens, latency_ms, error_message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(...values);
}

export async function runCopilot(
  request: CopilotRequest,
  actor: { orgId?: string | null; userId?: string | null } = {}
): Promise<CopilotResponse> {
  const startedAt = Date.now();
  const id = randomUUID();
  const question = request.question.trim();
  const intent = routeCopilotIntent(question, request.intent);
  let response: CopilotResponse;

  try {
    const opportunities = await resolveOpportunities({ ...request, question });
    const retrievedContext = await retrieveContext(opportunities);
    const citations = allCitations(retrievedContext);

    if (!question || citations.length === 0 || opportunities.length === 0) {
      response = missingEvidenceResponse(id, intent, retrievedContext);
    } else {
      const directAnswer = await buildDirectAnswer(intent, opportunities);
      response = {
        id,
        intent,
        directAnswer,
        citations: citations.slice(0, 8),
        confidence: confidenceFor(opportunities),
        assumptions: [
          "Answer is limited to currently stored Build Signals opportunities, source evidence, parcel context, graph relationships, and generated memos.",
          "Parcel context marked seeded or partial should be verified before underwriting.",
        ],
        suggestedNextActions: suggestedActions(intent, opportunities),
        retrievedContext,
        refused: false,
      };
    }

    await logCopilotRun({
      orgId: actor.orgId,
      userId: actor.userId,
      query: question,
      intent,
      retrievedContext: response.retrievedContext,
      response,
      latencyMs: Date.now() - startedAt,
    });

    return response;
  } catch (error) {
    response = missingEvidenceResponse(id, intent, {
      opportunities: [],
      graphRelationships: [],
      memoContext: [],
    });
    await logCopilotRun({
      orgId: actor.orgId,
      userId: actor.userId,
      query: question,
      intent,
      retrievedContext: response.retrievedContext,
      response,
      latencyMs: Date.now() - startedAt,
      errorMessage: error instanceof Error ? error.message : "Unknown Copilot error",
    });
    return response;
  }
}
