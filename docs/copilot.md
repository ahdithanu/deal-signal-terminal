# Build Signals Copilot

The Build Signals Copilot is a workflow-specific assistant for public-record development
intelligence. It is not a generic chatbot. It answers questions using Build Signals opportunity
records, permit signals, parcel context, graph relationships, memo context, score breakdowns, and
source evidence.

## Supported Intents

- Search opportunities
- Explain score
- Compare opportunities
- Summarize opportunity
- Generate executive memo
- Recommend next action
- Answer question with citations

Intent routing lives in `src/lib/copilot.ts`. The API accepts an explicit intent, but can infer one
from the user question.

## Retrieval Layer

The retrieval layer pulls from:

- ranked opportunities
- permit/source evidence attached to each opportunity
- parcel context
- score breakdowns
- generated memo-ready summaries
- opportunity graph relationships and relationship evidence

The first implementation is deterministic and evidence-bound. It intentionally prioritizes
traceability over broad natural-language creativity.

## Response Contract

Every response includes:

- direct answer
- citations
- confidence
- assumptions
- suggested next actions
- retrieved context
- refusal flag

If no evidence is retrieved, the Copilot refuses instead of inventing facts.

## Logging

Each run is stored in `copilot_runs` with:

- user query
- routed intent
- retrieved context
- response JSON
- model name
- token usage placeholders
- latency
- error message

Discrete user actions are also written to `audit_events` through the Copilot API route.

## Current Limitations

- The service uses deterministic synthesis first. LLM calls can be added later behind the same typed
  response contract.
- Token usage is currently stored as `0` for deterministic runs.
- Retrieval is lexical plus scoped context rather than vector search.
- Graph relationships are opportunistically retrieved and do not block an answer if unavailable.
- Parcel context marked seeded or partial must still be verified before underwriting.

## Future Improvements

- Add vector retrieval over source documents, memos, graph evidence, and customer notes.
- Use workspace deployment settings to select model provider and prompt template.
- Add tool calls for “add to watchlist,” “submit memo for review,” and “export memo.”
- Store model prompts and validated structured model outputs separately from deterministic fallback.
- Add per-answer evaluation labels from human review feedback.
