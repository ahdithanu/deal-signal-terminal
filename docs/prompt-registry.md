# Prompt Registry

## Customer Problem

Enterprise AI systems need prompt governance. Teams need to know which prompt is active, what changed,
who changed it, which output schema it expects, and how to roll forward safely after evals pass.

## Architecture Decision

Build Signals stores prompts in three first-party tables:

- `prompt_templates`
- `prompt_versions`
- `prompt_registry_events`

The registry seeds default templates for Copilot answers, opportunity memos, multi-agent research,
and score explanations. Admins can inspect prompts at `/admin/prompts` and manage versions through
`/api/admin/prompts`.

## Adding A Prompt Version

Create a draft version:

```json
{
  "action": "create_version",
  "promptKey": "copilot.answer.v1",
  "version": "copilot-answer-v2",
  "promptBody": "Answer only from retrieved Build Signals context...",
  "variables": ["question", "opportunities", "sourceEvidence"],
  "outputSchema": {
    "directAnswer": "string",
    "citations": "array"
  },
  "modelFamily": "structured-chat",
  "changelog": "Tighten refusal behavior."
}
```

Activate only after evals pass:

```json
{
  "action": "activate_version",
  "promptKey": "copilot.answer.v1",
  "versionId": "<prompt-version-id>"
}
```

## Tradeoffs Considered

- Registry-first before runtime switching. This PR builds governance without changing customer-facing
  AI behavior before enough eval history exists.
- Version activation is global for now. Workspace-specific prompt assignment should come after prompt
  eval gates and deployment settings are linked.
- Output schemas are JSON metadata rather than executable validators. Runtime structured-output
  validation can attach to these records in a later PR.

## Scaling Path To 1 Million Opportunities

At scale, prompt versions should be linked to eval runs, model deployments, workspace overrides, and
event-driven traces. This allows teams to compare prompt versions by market, workflow, customer,
latency, citation quality, hallucination risk, and conversion outcomes.
