import { randomUUID } from "node:crypto";

import { getDatabase, resolveDatabaseProvider } from "@/lib/db";
import { queryPostgres } from "@/lib/postgres";
import type { AgentRunResult, ResearchAgentStatus, ResearchPacket } from "@/types/research";

type AgentResearchRunRow = {
  id: string;
  opportunity_id: string;
  opportunity_slug: string;
  status: ResearchAgentStatus;
  model: string;
  prompt_version: string;
  started_at: string;
  finished_at: string | null;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_latency_ms: number;
  error_message: string | null;
  final_output_json: string;
};

type AgentResearchOutputRow = {
  id: string;
  run_id: string;
  agent_name: string;
  status: ResearchAgentStatus;
  model: string;
  prompt_version: string;
  started_at: string;
  finished_at: string;
  latency_ms: number;
  prompt_tokens: number;
  completion_tokens: number;
  error_message: string | null;
  input_json: string;
  output_json: string;
};

export async function createResearchRun(input: {
  opportunityId: string;
  opportunitySlug: string;
  model: string;
  promptVersion: string;
  startedAt?: string;
}) {
  const id = randomUUID();
  const startedAt = input.startedAt ?? new Date().toISOString();
  const values = [
    id,
    input.opportunityId,
    input.opportunitySlug,
    "succeeded",
    input.model,
    input.promptVersion,
    startedAt,
    null,
    0,
    0,
    0,
    null,
    "{}",
  ];

  if (resolveDatabaseProvider() === "postgres") {
    await queryPostgres(
      `INSERT INTO agent_research_runs (
        id, opportunity_id, opportunity_slug, status, model, prompt_version, started_at,
        finished_at, total_prompt_tokens, total_completion_tokens, total_latency_ms,
        error_message, final_output_json
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      values
    );
    return id;
  }

  getDatabase()
    .prepare(
      `INSERT INTO agent_research_runs (
        id, opportunity_id, opportunity_slug, status, model, prompt_version, started_at,
        finished_at, total_prompt_tokens, total_completion_tokens, total_latency_ms,
        error_message, final_output_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(...values);
  return id;
}

export async function recordAgentOutput(runId: string, result: AgentRunResult) {
  const values = [
    randomUUID(),
    runId,
    result.agentName,
    result.status,
    result.model,
    result.promptVersion,
    result.startedAt,
    result.finishedAt,
    result.latencyMs,
    result.tokenUsage.promptTokens,
    result.tokenUsage.completionTokens,
    result.error,
    JSON.stringify(result.input),
    JSON.stringify(result.output),
  ];

  if (resolveDatabaseProvider() === "postgres") {
    await queryPostgres(
      `INSERT INTO agent_research_outputs (
        id, run_id, agent_name, status, model, prompt_version, started_at, finished_at,
        latency_ms, prompt_tokens, completion_tokens, error_message, input_json, output_json
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      values
    );
    return;
  }

  getDatabase()
    .prepare(
      `INSERT INTO agent_research_outputs (
        id, run_id, agent_name, status, model, prompt_version, started_at, finished_at,
        latency_ms, prompt_tokens, completion_tokens, error_message, input_json, output_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(...values);
}

export async function finishResearchRun(packet: ResearchPacket, errorMessage?: string | null) {
  const values = [
    packet.status,
    packet.finishedAt,
    packet.totalTokenUsage.promptTokens,
    packet.totalTokenUsage.completionTokens,
    packet.totalTokenUsage.latencyMs,
    errorMessage ?? null,
    JSON.stringify(packet.finalOutput),
    packet.runId,
  ];

  if (resolveDatabaseProvider() === "postgres") {
    await queryPostgres(
      `UPDATE agent_research_runs SET
        status = $1,
        finished_at = $2,
        total_prompt_tokens = $3,
        total_completion_tokens = $4,
        total_latency_ms = $5,
        error_message = $6,
        final_output_json = $7
      WHERE id = $8`,
      values
    );
    return;
  }

  getDatabase()
    .prepare(
      `UPDATE agent_research_runs SET
        status = ?,
        finished_at = ?,
        total_prompt_tokens = ?,
        total_completion_tokens = ?,
        total_latency_ms = ?,
        error_message = ?,
        final_output_json = ?
      WHERE id = ?`
    )
    .run(...values);
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function getLatestResearchPacketForOpportunity(
  opportunityId: string
): Promise<ResearchPacket | null> {
  const run =
    resolveDatabaseProvider() === "postgres"
      ? (
          await queryPostgres<AgentResearchRunRow>(
            `SELECT * FROM agent_research_runs
            WHERE opportunity_id = $1
            ORDER BY started_at DESC
            LIMIT 1`,
            [opportunityId]
          )
        ).rows[0]
      : (getDatabase()
          .prepare(
            `SELECT * FROM agent_research_runs
            WHERE opportunity_id = ?
            ORDER BY started_at DESC
            LIMIT 1`
          )
          .get(opportunityId) as AgentResearchRunRow | undefined);

  if (!run) {
    return null;
  }

  const outputs =
    resolveDatabaseProvider() === "postgres"
      ? (
          await queryPostgres<AgentResearchOutputRow>(
            `SELECT * FROM agent_research_outputs
            WHERE run_id = $1
            ORDER BY started_at ASC`,
            [run.id]
          )
        ).rows
      : (getDatabase()
          .prepare(
            `SELECT * FROM agent_research_outputs
            WHERE run_id = ?
            ORDER BY started_at ASC`
          )
          .all(run.id) as AgentResearchOutputRow[]);

  const finalOutput = parseJson(run.final_output_json, null);

  if (!finalOutput) {
    return null;
  }

  return {
    runId: run.id,
    opportunityId: run.opportunity_id,
    opportunitySlug: run.opportunity_slug,
    status: run.status,
    model: run.model,
    promptVersion: run.prompt_version,
    startedAt: run.started_at,
    finishedAt: run.finished_at ?? run.started_at,
    totalTokenUsage: {
      promptTokens: Number(run.total_prompt_tokens),
      completionTokens: Number(run.total_completion_tokens),
      latencyMs: Number(run.total_latency_ms),
    },
    finalOutput,
    outputs: outputs.map((output) => ({
      agentName: output.agent_name as AgentRunResult["agentName"],
      status: output.status,
      model: output.model,
      promptVersion: output.prompt_version,
      startedAt: output.started_at,
      finishedAt: output.finished_at,
      latencyMs: Number(output.latency_ms),
      tokenUsage: {
        promptTokens: Number(output.prompt_tokens),
        completionTokens: Number(output.completion_tokens),
        latencyMs: Number(output.latency_ms),
      },
      input: parseJson(output.input_json, {}),
      output: parseJson(output.output_json, null),
      error: output.error_message,
    })),
  };
}
