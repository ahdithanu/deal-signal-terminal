"use client";

import { useState, useTransition } from "react";

import type {
  FeatureFlags,
  RateLimits,
  ScoringWeights,
  WorkspaceDeploymentConfig,
  WorkspaceDeploymentConfigHistory,
} from "@/types/deployment-config";

type Props = {
  initialConfig: WorkspaceDeploymentConfig;
  initialHistory: WorkspaceDeploymentConfigHistory[];
};

const modelProviders = ["openai", "anthropic", "azure_openai", "google", "local", "none"] as const;
const embeddingProviders = ["openai", "cohere", "voyage", "local", "none"] as const;
const promptTemplates = [
  "default",
  "enterprise_ic_memo",
  "risk_first",
  "broker_outreach",
  "source_audit",
] as const;

function parseJsonField<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

export function DeploymentSettingsConsole({ initialConfig, initialHistory }: Props) {
  const [config, setConfig] = useState(initialConfig);
  const [history, setHistory] = useState(initialHistory);
  const [notificationJson, setNotificationJson] = useState(
    JSON.stringify(initialConfig.notificationRules, null, 2)
  );
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateConfig(patch: Partial<WorkspaceDeploymentConfig>) {
    setConfig((current) => ({ ...current, ...patch }));
  }

  function updateScoringWeights(key: keyof ScoringWeights, value: number) {
    setConfig((current) => ({
      ...current,
      scoringWeights: { ...current.scoringWeights, [key]: value },
    }));
  }

  function updateRateLimits(key: keyof RateLimits, value: number) {
    setConfig((current) => ({
      ...current,
      rateLimits: { ...current.rateLimits, [key]: value },
    }));
  }

  function updateFeatureFlag(key: keyof FeatureFlags, value: boolean) {
    setConfig((current) => ({
      ...current,
      featureFlags: { ...current.featureFlags, [key]: value },
    }));
  }

  function saveSettings() {
    setError(null);
    setSavedMessage(null);

    const nextNotificationRules = parseJsonField(notificationJson, null);

    if (!nextNotificationRules) {
      setError("Notification rules must be valid JSON.");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/admin/deployment-settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          modelProvider: config.modelProvider,
          modelName: config.modelName,
          modelSecretRef: config.modelSecretRef,
          embeddingProvider: config.embeddingProvider,
          embeddingModelName: config.embeddingModelName,
          embeddingSecretRef: config.embeddingSecretRef,
          retrievalDepth: config.retrievalDepth,
          confidenceThreshold: config.confidenceThreshold,
          scoringWeights: config.scoringWeights,
          promptTemplateSelection: config.promptTemplateSelection,
          notificationRules: nextNotificationRules,
          rateLimits: config.rateLimits,
          featureFlags: config.featureFlags,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Deployment settings could not be saved.");
        return;
      }

      setConfig(payload.config);
      setHistory(payload.history);
      setNotificationJson(JSON.stringify(payload.config.notificationRules, null, 2));
      setSavedMessage("Deployment settings saved and history captured.");
    });
  }

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Admin console</p>
            <h1 className="detail-title">Deployment settings</h1>
            <p className="tight-copy">
              Configure workspace AI, retrieval, scoring, notifications, rate limits, and feature
              rollout without shipping code. Store only secret references, never plaintext API keys.
            </p>
          </div>
          <button className="button" type="button" onClick={saveSettings} disabled={isPending}>
            {isPending ? "Saving..." : "Save deployment settings"}
          </button>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        {savedMessage ? <p className="success-message">{savedMessage}</p> : null}
      </section>

      <section className="settings-grid">
        <div className="panel settings-card">
          <p className="eyebrow">AI models</p>
          <h2 className="section-title">Generation and prompt controls</h2>
          <div className="form-grid">
            <Field label="Model provider">
              <select
                className="field-input"
                value={config.modelProvider}
                onChange={(event) => updateConfig({ modelProvider: event.target.value as never })}
              >
                {modelProviders.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Model name">
              <input
                className="field-input"
                value={config.modelName}
                onChange={(event) => updateConfig({ modelName: event.target.value })}
              />
            </Field>
            <Field label="Model secret ref">
              <input
                className="field-input"
                value={config.modelSecretRef ?? ""}
                placeholder="env:OPENAI_API_KEY"
                onChange={(event) => updateConfig({ modelSecretRef: event.target.value || null })}
              />
            </Field>
            <Field label="Prompt template">
              <select
                className="field-input"
                value={config.promptTemplateSelection}
                onChange={(event) =>
                  updateConfig({ promptTemplateSelection: event.target.value as never })
                }
              >
                {promptTemplates.map((template) => (
                  <option key={template} value={template}>
                    {template}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <div className="panel settings-card">
          <p className="eyebrow">Retrieval settings</p>
          <h2 className="section-title">Evidence depth and embeddings</h2>
          <div className="form-grid">
            <Field label="Embedding provider">
              <select
                className="field-input"
                value={config.embeddingProvider}
                onChange={(event) => updateConfig({ embeddingProvider: event.target.value as never })}
              >
                {embeddingProviders.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Embedding model">
              <input
                className="field-input"
                value={config.embeddingModelName}
                onChange={(event) => updateConfig({ embeddingModelName: event.target.value })}
              />
            </Field>
            <Field label="Embedding secret ref">
              <input
                className="field-input"
                value={config.embeddingSecretRef ?? ""}
                placeholder="env:OPENAI_API_KEY"
                onChange={(event) => updateConfig({ embeddingSecretRef: event.target.value || null })}
              />
            </Field>
            <Field label="Retrieval depth">
              <input
                className="field-input"
                type="number"
                min={1}
                max={50}
                value={config.retrievalDepth}
                onChange={(event) => updateConfig({ retrievalDepth: Number(event.target.value) })}
              />
            </Field>
            <Field label="Confidence threshold">
              <input
                className="field-input"
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={config.confidenceThreshold}
                onChange={(event) => updateConfig({ confidenceThreshold: Number(event.target.value) })}
              />
            </Field>
          </div>
        </div>

        <div className="panel settings-card">
          <p className="eyebrow">Scoring settings</p>
          <h2 className="section-title">Priority model weights</h2>
          <div className="form-grid">
            {(Object.keys(config.scoringWeights) as Array<keyof ScoringWeights>).map((key) => (
              <Field key={key} label={key}>
                <input
                  className="field-input"
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={config.scoringWeights[key]}
                  onChange={(event) => updateScoringWeights(key, Number(event.target.value))}
                />
              </Field>
            ))}
          </div>
        </div>

        <div className="panel settings-card">
          <p className="eyebrow">Notifications</p>
          <h2 className="section-title">Rules and secure destinations</h2>
          <p className="subtle-text">
            Targets must be secure references like `env:SALES_ALERT_EMAIL` or
            `secret:SLACK_WEBHOOK_URL`.
          </p>
          <textarea
            className="field-input settings-textarea"
            value={notificationJson}
            onChange={(event) => setNotificationJson(event.target.value)}
          />
        </div>

        <div className="panel settings-card">
          <p className="eyebrow">Rate limits</p>
          <h2 className="section-title">Workspace usage caps</h2>
          <div className="form-grid">
            {(Object.keys(config.rateLimits) as Array<keyof RateLimits>).map((key) => (
              <Field key={key} label={key}>
                <input
                  className="field-input"
                  type="number"
                  min={1}
                  value={config.rateLimits[key]}
                  onChange={(event) => updateRateLimits(key, Number(event.target.value))}
                />
              </Field>
            ))}
          </div>
        </div>

        <div className="panel settings-card">
          <p className="eyebrow">Feature flags</p>
          <h2 className="section-title">Controlled rollout</h2>
          <div className="settings-toggle-stack">
            {(Object.keys(config.featureFlags) as Array<keyof FeatureFlags>).map((key) => (
              <label key={key} className="settings-toggle">
                <span>{key}</span>
                <input
                  type="checkbox"
                  checked={config.featureFlags[key]}
                  onChange={(event) => updateFeatureFlag(key, event.target.checked)}
                />
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Change history</p>
            <h2 className="section-title">Configuration audit trail</h2>
          </div>
          <div className="subtle-text">{history.length} recent changes</div>
        </div>
        <div className="review-history-stack">
          {history.length === 0 ? (
            <p className="subtle-text">No workspace overrides have been saved yet.</p>
          ) : (
            history.map((event) => (
              <div key={event.id} className="review-history-row">
                <strong>{event.section}</strong>
                <span>{new Date(event.changedAt).toLocaleString()}</span>
                <span>user {event.userId ?? "unknown"}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
