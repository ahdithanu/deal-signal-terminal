# Multi-Agent Research Orchestration

## Purpose

Build Signals uses a modular research system to turn opportunity records into evidence-backed
intelligence. The goal is not to run one giant prompt. The goal is to separate concerns, preserve
citations, tolerate partial failure, and store an audit trail for enterprise review.

## Agents

- Permit Agent: permit chronology, scope, signal strength, permit evidence gaps.
- Property Agent: parcel, property, ownership, zoning, site context.
- Company Agent: owners, contractors, developers, architects, engineers, lenders, brokers when
  explicitly present in source data.
- Risk Agent: diligence risks, severity, and mitigation.
- Market Agent: market/corridor/local context using scored opportunity metadata.
- Memo Agent: structured executive memo from specialist outputs.
- Coordinator Agent: combines outputs, notes conflicts, preserves missing data, and produces the
  final research packet.

## Contracts

All agent contracts live in `src/types/research.ts`.

Each agent has:

- typed input schema
- typed output schema
- prompt template
- tool access definition
- validation function
- citations
- confidence
- assumptions
- missing data

The current implementation uses deterministic source-grounded analysis while preserving model,
prompt version, token, and latency metadata. This keeps the interface ready for structured LLM
execution without hard-coding the system to one vendor.

## Storage

Research storage uses:

- `agent_research_runs`: one row per coordinated research run.
- `agent_research_outputs`: one row per specialist/coordinator output.

Stored metadata includes:

- model used
- prompt version
- token estimates or usage
- latency
- status
- errors
- structured input/output JSON
- final coordinator output

## Failure Behavior

The coordinator does not fail the entire user workflow if one specialist fails. It records the
failed agent output, continues with the surviving agents, and marks the final packet as partial.
The final memo must preserve missing data and uncertainty instead of filling gaps.

## API

- `GET /api/opportunities/:slug/research`: returns latest research packet for the opportunity.
- `POST /api/opportunities/:slug/research`: runs the multi-agent workflow and stores the packet.

## Frontend

The opportunity detail page includes a multi-agent research panel. Users can trigger a run, view
each agent contribution, inspect failures, and read the final coordinator memo.

## Adding a New Agent

1. Add input/output types to `src/types/research.ts`.
2. Add a `ResearchAgentDefinition` in `src/lib/research-agents.ts`.
3. Include a prompt template and tool access definition.
4. Validate output with a type guard.
5. Add the agent to coordinator sequencing.
6. Add tests for schema validation, failure behavior, and coordinator synthesis.

## Scaling Path

- Replace deterministic execution with structured model calls per agent.
- Add tool adapters for web search, county portals, graph traversal, filings, CRM, and document
  stores.
- Store raw model responses separately from validated structured outputs.
- Add human review queues for low-confidence or conflicting research packets.
- Add tenant/workspace isolation before customer-specific private data enters the research graph.
