# Admin Deployment Console

Build Signals supports workspace-level deployment settings so each enterprise customer can tune AI,
retrieval, scoring, notifications, rate limits, and feature rollout without code changes.

## Configuration Model

Current settings live in `workspace_deployment_configs`, keyed by `org_id`. Every material change
is written to `workspace_deployment_config_history` with:

- user id
- timestamp
- changed section
- old value
- new value
- metadata

The application always merges customer overrides with safe defaults. If a workspace has not been
configured yet, the backend returns defaults instead of requiring a row to exist.

## Configurable Sections

- AI models: model provider, model name, model secret reference, embedding provider, embedding
  model, embedding secret reference, and prompt template selection.
- Retrieval: retrieval depth and minimum confidence threshold.
- Scoring: explicit weights for site motion, ownership signal, permit value, recency, and risk.
- Notifications: enabled rules, channel, trigger, score threshold, and secure destination reference.
- Rate limits: AI requests per minute, research runs, memo generations, and ingest runs.
- Feature flags: multi-agent research, knowledge graph, human review workflow, nationwide ingestion,
  and external notifications.

## Secret Handling

The console intentionally does not accept plaintext API keys or webhook URLs. Sensitive fields must
be references such as:

- `env:OPENAI_API_KEY`
- `env:ANTHROPIC_API_KEY`
- `secret:SLACK_WEBHOOK_URL`
- `vault:customer-a/openai`

Secret resolution should happen server-side at the integration boundary. The frontend only sees the
reference name.

## Validation

The backend rejects invalid configuration before it can affect production workflows:

- unsupported model or embedding providers
- missing model names for enabled providers
- retrieval depth outside `1..50`
- confidence thresholds outside `0..1`
- scoring weights outside `0..5`
- invalid notification rules or plaintext destinations
- unsafe rate-limit values
- unknown prompt templates
- malformed feature flags

Validation is enforced in `src/lib/deployment-config.ts`, not only in the UI.

## Configuring a New Enterprise Customer

1. Create or identify the customer's organization and admin user.
2. Add any required provider secrets to the deployment environment or secret manager.
3. Open `/admin/deployment-settings` as an admin.
4. Select the model provider and model name.
5. Enter only secret references, not raw API keys.
6. Set retrieval depth and confidence threshold for the customer's tolerance.
7. Tune scoring weights to match the customer's acquisition strategy.
8. Add notification rules using secure destination references.
9. Set rate limits that match the customer contract.
10. Enable only the feature flags that are ready for that customer.
11. Save and confirm the change appears in the configuration audit trail.

## Future Scaling Path

- Add per-market overrides for customers with region-specific scoring needs.
- Add secret-resolution adapters for Vercel, Vault, AWS Secrets Manager, and customer-managed KMS.
- Connect rate limits to request middleware instead of treating them as stored policy only.
- Add approval workflows for configuration changes before production rollout.
- Add config snapshots to AI/research run records for reproducible analysis.
