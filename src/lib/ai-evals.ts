import { randomUUID } from "node:crypto";

import { buildOpportunitySummary, generateOpportunityMemo } from "@/lib/ai";
import { runCopilot } from "@/lib/copilot";
import { getDatabase, resolveDatabaseProvider } from "@/lib/db";
import { emitDomainEvent } from "@/lib/domain-events";
import { getOpenAIConfig } from "@/lib/env";
import { getOpportunityBySlugWithGenerated } from "@/lib/opportunity-service";
import { runMultiAgentResearch } from "@/lib/research-agents";
import { queryPostgres } from "@/lib/postgres";
import type {
  EvalAssertion,
  EvalCase,
  EvalDataset,
  EvalMetric,
  EvalResult,
  EvalRubric,
  EvalRun,
  EvalRunComparison,
  EvalStatus,
  EvalWorkflow,
} from "@/types/evals";

const PROMPT_VERSION = "eval-platform-v1";

type DatasetRow = {
  id: string;
  name: string;
  description: string;
  workflow: EvalWorkflow;
  critical_threshold: number;
  created_at: string;
  updated_at: string;
};

type CaseRow = {
  id: string;
  dataset_id: string;
  name: string;
  input_json: string;
  expected_output_json: string;
  retrieved_context_json: string;
  rubric_json: string;
  created_at: string;
  updated_at: string;
};

type RunRow = {
  id: string;
  dataset_id: string;
  status: EvalStatus;
  prompt_version: string;
  model: string;
  started_at: string;
  finished_at: string | null;
  total_cases: number;
  passed_cases: number;
  average_score: number;
  gate_threshold: number;
  gate_passed: boolean | 0 | 1;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_cost_usd: number;
  summary_json: string;
};

type ResultRow = {
  id: string;
  run_id: string;
  case_id: string;
  status: EvalStatus;
  score: number;
  expected_output_json: string;
  actual_output_json: string;
  retrieved_context_json: string;
  citation_accuracy: number;
  hallucination_risk: number;
  factual_coverage: number;
  latency_ms: number;
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd: number;
  assertions_json: string;
  error_message: string | null;
  created_at: string;
};

type MetricRow = {
  id: string;
  result_id: string;
  metric_name: EvalMetric["metricName"];
  metric_value: number;
  threshold: number | null;
  passed: boolean | 0 | 1;
  created_at: string;
};

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function estimateTokens(value: unknown) {
  return Math.ceil(JSON.stringify(value).length / 4);
}

function caseFromRow(row: CaseRow): EvalCase {
  return {
    id: row.id,
    datasetId: row.dataset_id,
    name: row.name,
    input: parseJson(row.input_json, { question: "" }),
    expectedOutput: parseJson(row.expected_output_json, {}),
    retrievedContext: parseJson(row.retrieved_context_json, {}),
    rubric: parseJson(row.rubric_json, {
      minScore: 0.8,
      minCitationAccuracy: 0.8,
      maxHallucinationRisk: 0.2,
      minFactualCoverage: 0.7,
    }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function metricFromRow(row: MetricRow): EvalMetric {
  return {
    id: row.id,
    resultId: row.result_id,
    metricName: row.metric_name,
    metricValue: Number(row.metric_value),
    threshold: row.threshold == null ? null : Number(row.threshold),
    passed: Boolean(row.passed),
    createdAt: row.created_at,
  };
}

function resultFromRow(row: ResultRow, metrics: EvalMetric[] = []): EvalResult {
  return {
    id: row.id,
    runId: row.run_id,
    caseId: row.case_id,
    status: row.status,
    score: Number(row.score),
    expectedOutput: parseJson(row.expected_output_json, {}),
    actualOutput: parseJson(row.actual_output_json, {}),
    retrievedContext: parseJson(row.retrieved_context_json, {}),
    citationAccuracy: Number(row.citation_accuracy),
    hallucinationRisk: Number(row.hallucination_risk),
    factualCoverage: Number(row.factual_coverage),
    latencyMs: Number(row.latency_ms),
    promptTokens: Number(row.prompt_tokens),
    completionTokens: Number(row.completion_tokens),
    costUsd: Number(row.cost_usd),
    assertions: parseJson(row.assertions_json, []),
    metrics,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  };
}

function runFromRow(row: RunRow, results: EvalResult[] = []): EvalRun {
  return {
    id: row.id,
    datasetId: row.dataset_id,
    status: row.status,
    promptVersion: row.prompt_version,
    model: row.model,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    totalCases: Number(row.total_cases),
    passedCases: Number(row.passed_cases),
    averageScore: Number(row.average_score),
    gateThreshold: Number(row.gate_threshold),
    gatePassed: Boolean(row.gate_passed),
    totalPromptTokens: Number(row.total_prompt_tokens),
    totalCompletionTokens: Number(row.total_completion_tokens),
    totalCostUsd: Number(row.total_cost_usd),
    summary: parseJson(row.summary_json, {}),
    results,
  };
}

function datasetFromRows(row: DatasetRow, cases: EvalCase[]): EvalDataset {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    workflow: row.workflow,
    criticalThreshold: Number(row.critical_threshold),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    cases,
  };
}

function defaultDatasets(now: string): EvalDataset[] {
  const baseRubric: EvalRubric = {
    minScore: 0.8,
    minCitationAccuracy: 0.75,
    maxHallucinationRisk: 0.25,
    minFactualCoverage: 0.7,
  };

  return [
    {
      id: "copilot-answers-core",
      name: "Copilot answers",
      description: "Citation-backed answers, refusals, and workflow intent routing.",
      workflow: "copilot_answers",
      criticalThreshold: 0.82,
      createdAt: now,
      updatedAt: now,
      cases: [
        {
          id: "copilot-quantum-score",
          datasetId: "copilot-answers-core",
          name: "Explain Quantum Care score",
          input: {
            question: "Explain the score for Quantum Care",
            opportunitySlug: "quantum-care-sales-office-trailer",
          },
          expectedOutput: { intent: "explain_score", mustCite: true },
          retrievedContext: { opportunitySlug: "quantum-care-sales-office-trailer" },
          rubric: { ...baseRubric, expectedIntent: "explain_score", requiredPhrases: ["scores"] },
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "copilot-refusal-empty",
          datasetId: "copilot-answers-core",
          name: "Refuse missing evidence",
          input: { question: "   " },
          expectedOutput: { refused: true },
          retrievedContext: {},
          rubric: { ...baseRubric, minScore: 1, requireRefusal: true },
          createdAt: now,
          updatedAt: now,
        },
      ],
    },
    {
      id: "opportunity-memos-core",
      name: "Opportunity memos",
      description: "Memo drafts preserve missing facts and source-grounded deal relevance.",
      workflow: "opportunity_memos",
      criticalThreshold: 0.78,
      createdAt: now,
      updatedAt: now,
      cases: [
        {
          id: "memo-quantum-care",
          datasetId: "opportunity-memos-core",
          name: "Quantum Care memo",
          input: { question: "Generate memo", opportunitySlug: "quantum-care-sales-office-trailer" },
          expectedOutput: { requiredSections: ["Situation", "Recommended"] },
          retrievedContext: { opportunitySlug: "quantum-care-sales-office-trailer" },
          rubric: { ...baseRubric, requiredPhrases: ["Quantum Care"] },
          createdAt: now,
          updatedAt: now,
        },
      ],
    },
    {
      id: "multi-agent-research-core",
      name: "Multi-agent research outputs",
      description: "Coordinator output keeps citations, missing data, and specialist synthesis.",
      workflow: "multi_agent_research",
      criticalThreshold: 0.8,
      createdAt: now,
      updatedAt: now,
      cases: [
        {
          id: "research-quantum-care",
          datasetId: "multi-agent-research-core",
          name: "Quantum Care research packet",
          input: { question: "Run research", opportunitySlug: "quantum-care-sales-office-trailer" },
          expectedOutput: { specialistOutputs: true },
          retrievedContext: { opportunitySlug: "quantum-care-sales-office-trailer" },
          rubric: { ...baseRubric, requiredPhrases: ["research"] },
          createdAt: now,
          updatedAt: now,
        },
      ],
    },
    {
      id: "score-explanations-core",
      name: "Score explanations",
      description: "Priority explanations cite score dimensions and source records.",
      workflow: "score_explanations",
      criticalThreshold: 0.85,
      createdAt: now,
      updatedAt: now,
      cases: [
        {
          id: "score-quantum-care",
          datasetId: "score-explanations-core",
          name: "Quantum Care score details",
          input: {
            question: "Explain the score for Quantum Care",
            opportunitySlug: "quantum-care-sales-office-trailer",
          },
          expectedOutput: { mentionsScoreBreakdown: true },
          retrievedContext: { opportunitySlug: "quantum-care-sales-office-trailer" },
          rubric: { ...baseRubric, expectedIntent: "explain_score", requiredPhrases: ["contributor"] },
          createdAt: now,
          updatedAt: now,
        },
      ],
    },
  ];
}

async function insertDataset(dataset: EvalDataset) {
  const values = [
    dataset.id,
    dataset.name,
    dataset.description,
    dataset.workflow,
    dataset.criticalThreshold,
    dataset.createdAt,
    dataset.updatedAt,
  ];

  if (resolveDatabaseProvider() === "postgres") {
    await queryPostgres(
      `INSERT INTO eval_dataset (id, name, description, workflow, critical_threshold, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO NOTHING`,
      values
    );
  } else {
    getDatabase()
      .prepare(
        `INSERT OR IGNORE INTO eval_dataset (id, name, description, workflow, critical_threshold, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(...values);
  }

  for (const testCase of dataset.cases) {
    const caseValues = [
      testCase.id,
      testCase.datasetId,
      testCase.name,
      JSON.stringify(testCase.input),
      JSON.stringify(testCase.expectedOutput),
      JSON.stringify(testCase.retrievedContext),
      JSON.stringify(testCase.rubric),
      testCase.createdAt,
      testCase.updatedAt,
    ];
    if (resolveDatabaseProvider() === "postgres") {
      await queryPostgres(
        `INSERT INTO eval_case (
          id, dataset_id, name, input_json, expected_output_json, retrieved_context_json,
          rubric_json, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO NOTHING`,
        caseValues
      );
    } else {
      getDatabase()
        .prepare(
          `INSERT OR IGNORE INTO eval_case (
            id, dataset_id, name, input_json, expected_output_json, retrieved_context_json,
            rubric_json, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(...caseValues);
    }
  }
}

export async function createEvalDataset(input: {
  id?: string;
  name: string;
  description: string;
  workflow: EvalWorkflow;
  criticalThreshold: number;
  cases: Array<{
    id?: string;
    name: string;
    input: EvalCase["input"];
    expectedOutput: Record<string, unknown>;
    retrievedContext?: Record<string, unknown>;
    rubric: EvalRubric;
  }>;
}) {
  if (!input.name.trim()) {
    throw new Error("Eval dataset name is required.");
  }
  if (input.criticalThreshold < 0 || input.criticalThreshold > 1) {
    throw new Error("Eval dataset criticalThreshold must be between 0 and 1.");
  }
  if (!input.cases.length) {
    throw new Error("Eval dataset must include at least one case.");
  }

  const now = new Date().toISOString();
  const datasetId = input.id ?? randomUUID();
  const dataset: EvalDataset = {
    id: datasetId,
    name: input.name.trim(),
    description: input.description.trim(),
    workflow: input.workflow,
    criticalThreshold: input.criticalThreshold,
    createdAt: now,
    updatedAt: now,
    cases: input.cases.map((testCase) => ({
      id: testCase.id ?? randomUUID(),
      datasetId,
      name: testCase.name,
      input: testCase.input,
      expectedOutput: testCase.expectedOutput,
      retrievedContext: testCase.retrievedContext ?? {},
      rubric: testCase.rubric,
      createdAt: now,
      updatedAt: now,
    })),
  };

  await insertDataset(dataset);
  return dataset;
}

export async function ensureDefaultEvalDatasets() {
  const now = new Date().toISOString();
  for (const dataset of defaultDatasets(now)) {
    await insertDataset(dataset);
  }
}

export async function getEvalDataset(datasetId: string): Promise<EvalDataset | null> {
  await ensureDefaultEvalDatasets();

  if (resolveDatabaseProvider() === "postgres") {
    const dataset = await queryPostgres<DatasetRow>("SELECT * FROM eval_dataset WHERE id = $1", [datasetId]);
    if (!dataset.rows[0]) return null;
    const cases = await queryPostgres<CaseRow>(
      "SELECT * FROM eval_case WHERE dataset_id = $1 ORDER BY created_at ASC",
      [datasetId]
    );
    return datasetFromRows(dataset.rows[0], cases.rows.map(caseFromRow));
  }

  const db = getDatabase();
  const dataset = db.prepare("SELECT * FROM eval_dataset WHERE id = ?").get(datasetId) as DatasetRow | undefined;
  if (!dataset) return null;
  const cases = db
    .prepare("SELECT * FROM eval_case WHERE dataset_id = ? ORDER BY created_at ASC")
    .all(datasetId) as CaseRow[];
  return datasetFromRows(dataset, cases.map(caseFromRow));
}

export async function listEvalDatasets(): Promise<EvalDataset[]> {
  await ensureDefaultEvalDatasets();

  const rows =
    resolveDatabaseProvider() === "postgres"
      ? (await queryPostgres<DatasetRow>("SELECT * FROM eval_dataset ORDER BY created_at ASC")).rows
      : (getDatabase().prepare("SELECT * FROM eval_dataset ORDER BY created_at ASC").all() as DatasetRow[]);

  return (await Promise.all(rows.map((row) => getEvalDataset(row.id)))).filter(
    (dataset): dataset is EvalDataset => Boolean(dataset)
  );
}

async function executeCase(dataset: EvalDataset, testCase: EvalCase) {
  const opportunitySlug = testCase.input.opportunitySlug;
  const opportunity = opportunitySlug
    ? await getOpportunityBySlugWithGenerated(opportunitySlug)
    : undefined;

  if (dataset.workflow === "opportunity_memos" && opportunity) {
    const memo = await generateOpportunityMemo(opportunity);
    return {
      directAnswer: memo.body,
      citations: opportunity.evidence,
      retrievedContext: { opportunitySlug, evidenceCount: opportunity.evidence.length },
      refused: false,
      intent: "generate_executive_memo",
    };
  }

  if (dataset.workflow === "multi_agent_research" && opportunity) {
    const packet = await runMultiAgentResearch({ opportunity });
    return {
      directAnswer: packet.finalOutput.finalMemo,
      citations: packet.finalOutput.specialistOutputs.flatMap((output) => output.output?.citations ?? []),
      retrievedContext: { opportunitySlug, agents: packet.finalOutput.specialistOutputs.length },
      refused: false,
      intent: "multi_agent_research",
    };
  }

  return runCopilot(testCase.input);
}

function evaluateOutput(output: unknown, rubric: EvalRubric) {
  const response = output as {
    directAnswer?: string;
    citations?: unknown[];
    refused?: boolean;
    intent?: string;
    retrievedContext?: unknown;
  };
  const answer = response.directAnswer ?? "";
  const citationCount = response.citations?.length ?? 0;
  const assertions: EvalAssertion[] = [];

  if (rubric.expectedIntent) {
    assertions.push({
      name: "expected_intent",
      passed: response.intent === rubric.expectedIntent,
      detail: `Expected ${rubric.expectedIntent}, received ${response.intent ?? "none"}.`,
    });
  }
  if (rubric.requireRefusal) {
    assertions.push({
      name: "refusal",
      passed: Boolean(response.refused),
      detail: response.refused ? "Refused as expected." : "Did not refuse.",
    });
  }
  for (const phrase of rubric.requiredPhrases ?? []) {
    assertions.push({
      name: `phrase:${phrase}`,
      passed: answer.toLowerCase().includes(phrase.toLowerCase()),
      detail: `Answer ${answer.toLowerCase().includes(phrase.toLowerCase()) ? "contains" : "does not contain"} ${phrase}.`,
    });
  }

  const citationAccuracy = rubric.requireRefusal ? (response.refused ? 1 : 0) : citationCount > 0 ? 1 : 0;
  const hallucinationRisk = response.refused ? 0 : citationCount > 0 ? 0.08 : 0.65;
  const factualCoverage = answer.length > 40 || response.refused ? 1 : 0.4;
  assertions.push({
    name: "citation_accuracy",
    passed: citationAccuracy >= rubric.minCitationAccuracy,
    detail: `${citationAccuracy}`,
  });
  assertions.push({
    name: "hallucination_risk",
    passed: hallucinationRisk <= rubric.maxHallucinationRisk,
    detail: `${hallucinationRisk}`,
  });
  assertions.push({
    name: "factual_coverage",
    passed: factualCoverage >= rubric.minFactualCoverage,
    detail: `${factualCoverage}`,
  });

  const assertionScore = assertions.filter((assertion) => assertion.passed).length / assertions.length;
  const score = (assertionScore + citationAccuracy + (1 - hallucinationRisk) + factualCoverage) / 4;

  return { assertions, citationAccuracy, hallucinationRisk, factualCoverage, score };
}

async function insertRun(row: RunRow) {
  const values = [
    row.id,
    row.dataset_id,
    row.status,
    row.prompt_version,
    row.model,
    row.started_at,
    row.finished_at,
    row.total_cases,
    row.passed_cases,
    row.average_score,
    row.gate_threshold,
    row.gate_passed,
    row.total_prompt_tokens,
    row.total_completion_tokens,
    row.total_cost_usd,
    row.summary_json,
  ];
  const postgres = `INSERT INTO eval_run (
    id, dataset_id, status, prompt_version, model, started_at, finished_at,
    total_cases, passed_cases, average_score, gate_threshold, gate_passed,
    total_prompt_tokens, total_completion_tokens, total_cost_usd, summary_json
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`;
  const sqlite = postgres.replace(/\$\d+/g, "?");
  if (resolveDatabaseProvider() === "postgres") {
    await queryPostgres(postgres, values);
  } else {
    getDatabase()
      .prepare(sqlite)
      .run(...values.map((value) => (typeof value === "boolean" ? (value ? 1 : 0) : value)));
  }
}

async function updateRun(row: RunRow) {
  const values = [
    row.status,
    row.finished_at,
    row.total_cases,
    row.passed_cases,
    row.average_score,
    row.gate_passed,
    row.total_prompt_tokens,
    row.total_completion_tokens,
    row.total_cost_usd,
    row.summary_json,
    row.id,
  ];
  if (resolveDatabaseProvider() === "postgres") {
    await queryPostgres(
      `UPDATE eval_run SET status = $1, finished_at = $2, total_cases = $3, passed_cases = $4,
       average_score = $5, gate_passed = $6, total_prompt_tokens = $7,
       total_completion_tokens = $8, total_cost_usd = $9, summary_json = $10 WHERE id = $11`,
      values
    );
  } else {
    getDatabase()
      .prepare(
        `UPDATE eval_run SET status = ?, finished_at = ?, total_cases = ?, passed_cases = ?,
         average_score = ?, gate_passed = ?, total_prompt_tokens = ?,
         total_completion_tokens = ?, total_cost_usd = ?, summary_json = ? WHERE id = ?`
      )
      .run(...values.map((value) => (typeof value === "boolean" ? (value ? 1 : 0) : value)));
  }
}

async function insertResult(result: EvalResult) {
  const values = [
    result.id,
    result.runId,
    result.caseId,
    result.status,
    result.score,
    JSON.stringify(result.expectedOutput),
    JSON.stringify(result.actualOutput),
    JSON.stringify(result.retrievedContext),
    result.citationAccuracy,
    result.hallucinationRisk,
    result.factualCoverage,
    result.latencyMs,
    result.promptTokens,
    result.completionTokens,
    result.costUsd,
    JSON.stringify(result.assertions),
    result.errorMessage,
    result.createdAt,
  ];
  const postgres = `INSERT INTO eval_result (
    id, run_id, case_id, status, score, expected_output_json, actual_output_json,
    retrieved_context_json, citation_accuracy, hallucination_risk, factual_coverage,
    latency_ms, prompt_tokens, completion_tokens, cost_usd, assertions_json, error_message, created_at
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`;
  const sqlite = postgres.replace(/\$\d+/g, "?");
  if (resolveDatabaseProvider() === "postgres") {
    await queryPostgres(postgres, values);
  } else {
    getDatabase()
      .prepare(sqlite)
      .run(...values.map((value) => (typeof value === "boolean" ? (value ? 1 : 0) : value)));
  }

  for (const metric of result.metrics) {
    const metricValues = [
      metric.id,
      metric.resultId,
      metric.metricName,
      metric.metricValue,
      metric.threshold,
      metric.passed,
      metric.createdAt,
    ];
    if (resolveDatabaseProvider() === "postgres") {
      await queryPostgres(
        `INSERT INTO eval_metric (id, result_id, metric_name, metric_value, threshold, passed, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        metricValues
      );
    } else {
      getDatabase()
        .prepare(
          `INSERT INTO eval_metric (id, result_id, metric_name, metric_value, threshold, passed, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(...metricValues.map((value) => (typeof value === "boolean" ? (value ? 1 : 0) : value)));
    }
  }
}

export async function runEvalDataset(datasetId = "copilot-answers-core"): Promise<EvalRun> {
  const dataset = await getEvalDataset(datasetId);
  if (!dataset) throw new Error(`Eval dataset ${datasetId} not found.`);

  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  const model = getOpenAIConfig().model;
  const runRow: RunRow = {
    id: runId,
    dataset_id: dataset.id,
    status: "running",
    prompt_version: PROMPT_VERSION,
    model,
    started_at: startedAt,
    finished_at: null,
    total_cases: dataset.cases.length,
    passed_cases: 0,
    average_score: 0,
    gate_threshold: dataset.criticalThreshold,
    gate_passed: false,
    total_prompt_tokens: 0,
    total_completion_tokens: 0,
    total_cost_usd: 0,
    summary_json: JSON.stringify({ workflow: dataset.workflow }),
  };
  await insertRun(runRow);

  const results: EvalResult[] = [];
  for (const testCase of dataset.cases) {
    const caseStartedAt = Date.now();
    try {
      const output = await executeCase(dataset, testCase);
      const metrics = evaluateOutput(output, testCase.rubric);
      const promptTokens = estimateTokens(testCase.input);
      const completionTokens = estimateTokens(output);
      const resultId = randomUUID();
      const createdAt = new Date().toISOString();
      const resultMetrics: EvalMetric[] = [
        ["citation_accuracy", metrics.citationAccuracy, testCase.rubric.minCitationAccuracy, metrics.citationAccuracy >= testCase.rubric.minCitationAccuracy],
        ["hallucination_risk", metrics.hallucinationRisk, testCase.rubric.maxHallucinationRisk, metrics.hallucinationRisk <= testCase.rubric.maxHallucinationRisk],
        ["factual_coverage", metrics.factualCoverage, testCase.rubric.minFactualCoverage, metrics.factualCoverage >= testCase.rubric.minFactualCoverage],
        ["overall_score", metrics.score, testCase.rubric.minScore, metrics.score >= testCase.rubric.minScore],
      ].map(([metricName, metricValue, threshold, passed]) => ({
        id: randomUUID(),
        resultId,
        metricName: metricName as EvalMetric["metricName"],
        metricValue: metricValue as number,
        threshold: threshold as number,
        passed: passed as boolean,
        createdAt,
      }));
      const result: EvalResult = {
        id: resultId,
        runId,
        caseId: testCase.id,
        status: metrics.score >= testCase.rubric.minScore ? "passed" : "failed",
        score: metrics.score,
        expectedOutput: testCase.expectedOutput,
        actualOutput: output,
        retrievedContext: (output as { retrievedContext?: Record<string, unknown> }).retrievedContext ?? testCase.retrievedContext,
        citationAccuracy: metrics.citationAccuracy,
        hallucinationRisk: metrics.hallucinationRisk,
        factualCoverage: metrics.factualCoverage,
        latencyMs: Date.now() - caseStartedAt,
        promptTokens,
        completionTokens,
        costUsd: 0,
        assertions: metrics.assertions,
        metrics: resultMetrics,
        errorMessage: null,
        createdAt,
      };
      await insertResult(result);
      results.push(result);
    } catch (error) {
      const result: EvalResult = {
        id: randomUUID(),
        runId,
        caseId: testCase.id,
        status: "error",
        score: 0,
        expectedOutput: testCase.expectedOutput,
        actualOutput: {},
        retrievedContext: testCase.retrievedContext,
        citationAccuracy: 0,
        hallucinationRisk: 1,
        factualCoverage: 0,
        latencyMs: Date.now() - caseStartedAt,
        promptTokens: estimateTokens(testCase.input),
        completionTokens: 0,
        costUsd: 0,
        assertions: [{ name: "runtime_error", passed: false, detail: "Case threw during execution." }],
        metrics: [],
        errorMessage: error instanceof Error ? error.message : "Unknown eval error",
        createdAt: new Date().toISOString(),
      };
      await insertResult(result);
      results.push(result);
    }
  }

  const passedCases = results.filter((result) => result.status === "passed").length;
  const averageScore = results.reduce((sum, result) => sum + result.score, 0) / Math.max(results.length, 1);
  const totalPromptTokens = results.reduce((sum, result) => sum + result.promptTokens, 0);
  const totalCompletionTokens = results.reduce((sum, result) => sum + result.completionTokens, 0);
  const finishedRow: RunRow = {
    ...runRow,
    status: averageScore >= dataset.criticalThreshold ? "passed" : "failed",
    finished_at: new Date().toISOString(),
    passed_cases: passedCases,
    average_score: averageScore,
    gate_passed: averageScore >= dataset.criticalThreshold,
    total_prompt_tokens: totalPromptTokens,
    total_completion_tokens: totalCompletionTokens,
    summary_json: JSON.stringify({
      workflow: dataset.workflow,
      regressionGate: averageScore >= dataset.criticalThreshold ? "passed" : "failed",
      failedCases: results.filter((result) => result.status !== "passed").map((result) => result.caseId),
    }),
  };
  await updateRun(finishedRow);
  await emitDomainEvent({
    eventType: "eval.run.completed",
    aggregateType: "eval_run",
    aggregateId: runId,
    payload: {
      datasetId: dataset.id,
      workflow: dataset.workflow,
      status: finishedRow.status,
      averageScore,
      gatePassed: finishedRow.gate_passed,
      totalCases: dataset.cases.length,
      passedCases,
      failedCases: results.filter((result) => result.status !== "passed").map((result) => result.caseId),
    },
  });

  return runFromRow(finishedRow, results);
}

export async function listEvalRuns(limit = 20): Promise<EvalRun[]> {
  await ensureDefaultEvalDatasets();
  const rows =
    resolveDatabaseProvider() === "postgres"
      ? (await queryPostgres<RunRow>("SELECT * FROM eval_run ORDER BY started_at DESC LIMIT $1", [limit])).rows
      : (getDatabase().prepare("SELECT * FROM eval_run ORDER BY started_at DESC LIMIT ?").all(limit) as RunRow[]);
  return rows.map((row) => runFromRow(row));
}

export async function compareEvalRuns(leftRunId: string, rightRunId: string): Promise<EvalRunComparison> {
  const runs = await listEvalRuns(100);
  const left = runs.find((run) => run.id === leftRunId);
  const right = runs.find((run) => run.id === rightRunId);
  if (!left || !right) throw new Error("Both eval runs must exist to compare.");

  return {
    leftRunId,
    rightRunId,
    scoreDelta: right.averageScore - left.averageScore,
    citationAccuracyDelta: 0,
    hallucinationRiskDelta: 0,
    factualCoverageDelta: 0,
    regressionDetected: right.averageScore < left.averageScore || !right.gatePassed,
  };
}
