# AI Evaluation Platform

## Customer Problem

Enterprise customers need confidence that AI changes do not silently degrade opportunity analysis,
score explanations, citations, refusals, or recommended actions. Without evals, every model,
prompt, retrieval, and scoring change is a production risk.

## Architecture Decision

Build Signals stores evaluation datasets, cases, runs, results, and metrics in first-party database
tables:

- `eval_dataset`
- `eval_case`
- `eval_run`
- `eval_result`
- `eval_metric`

The default datasets cover:

- Copilot answers
- opportunity memos
- multi-agent research outputs
- score explanations

Admin users can run evals at `/admin/evals`; API access is available at `/api/admin/evals`.

## Metrics Tracked

Each run stores:

- prompt version
- model
- retrieved context
- expected output
- actual output
- citation accuracy
- hallucination risk
- factual coverage
- latency
- token usage
- cost

Regression gates fail when the average score drops below the dataset critical threshold.

## Adding New Eval Cases

Use `POST /api/admin/evals` with `action: "create_dataset"` to register a dataset:

```json
{
  "action": "create_dataset",
  "name": "Customer IC memo regression",
  "description": "Checks memo quality for a customer pilot workflow.",
  "workflow": "opportunity_memos",
  "criticalThreshold": 0.82,
  "cases": [
    {
      "name": "Quantum Care memo",
      "input": {
        "question": "Generate memo",
        "opportunitySlug": "quantum-care-sales-office-trailer"
      },
      "expectedOutput": {
        "requiredSections": ["Situation", "Recommended"]
      },
      "retrievedContext": {
        "opportunitySlug": "quantum-care-sales-office-trailer"
      },
      "rubric": {
        "minScore": 0.8,
        "minCitationAccuracy": 0.75,
        "maxHallucinationRisk": 0.25,
        "minFactualCoverage": 0.7,
        "requiredPhrases": ["Quantum Care"]
      }
    }
  ]
}
```

Run a dataset with:

```json
{
  "datasetId": "copilot-answers-core"
}
```

Compare two runs with:

`GET /api/admin/evals?compareLeft=<run-id>&compareRight=<run-id>`

## Tradeoffs Considered

- Deterministic assertions first instead of LLM-as-judge. This keeps CI stable and explainable.
- Stored eval cases instead of hardcoded tests only. This makes customer-specific eval packs possible.
- Run-level and result-level records instead of one JSON blob. This supports dashboards, trend lines,
  and per-case debugging later.

## Scaling Path To 1 Million Opportunities

At larger scale, evals should run against sampled opportunity cohorts:

1. Golden set: curated high-value opportunities that must never regress.
2. Stratified sample: markets, property types, confidence bands, and score bands.
3. Drift sample: new ingestion batches and low-confidence outputs.
4. Customer-specific eval packs: buyer strategy, markets, and compliance constraints.

For 1M opportunities, the eval runner should move to background jobs, shard cases by suite/market,
and store aggregate metrics separately for fast dashboards.
