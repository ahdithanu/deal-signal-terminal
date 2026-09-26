"use client";

import { useRef, useState, type FormEvent } from "react";

import type { PublicApiKeyRecord, PublicApiRequestLog } from "@/types/public-api";

type Scope = PublicApiKeyRecord["scopes"][number];
type Props = {
  initialKeys: PublicApiKeyRecord[];
  initialRequestLogs: PublicApiRequestLog[];
  scopes: readonly Scope[];
};
type PendingAction =
  | { kind: "create" }
  | { kind: "refresh" }
  | { kind: "revoke"; keyId: string };
type IssuedSecret = { keyId: string; name: string; value: string };

const scopeDescriptions: Record<Scope, string> = {
  "opportunities:read": "Read the opportunity catalog and individual opportunities.",
  "opportunities:graph:read": "Read public-source relationship graphs for opportunities.",
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isScope(value: unknown): value is Scope {
  return value === "opportunities:read" || value === "opportunities:graph:read";
}

function isNullableString(value: unknown) {
  return value === null || typeof value === "string";
}

function isKey(value: unknown): value is PublicApiKeyRecord {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.orgId === "string" &&
    typeof value.name === "string" &&
    typeof value.keyPrefix === "string" &&
    typeof value.keyLast4 === "string" &&
    Array.isArray(value.scopes) &&
    value.scopes.every(isScope) &&
    (value.status === "active" || value.status === "revoked") &&
    Number.isSafeInteger(value.rateLimitPerMinute) &&
    Number(value.rateLimitPerMinute) > 0 &&
    isNullableString(value.expiresAt) &&
    isNullableString(value.lastUsedAt) &&
    isNullableString(value.createdByUserId) &&
    typeof value.createdAt === "string" &&
    isNullableString(value.revokedAt)
  );
}

function isRequestLog(value: unknown): value is PublicApiRequestLog {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    isNullableString(value.orgId) &&
    isNullableString(value.apiKeyId) &&
    typeof value.route === "string" &&
    typeof value.method === "string" &&
    Number.isInteger(value.statusCode) &&
    typeof value.latencyMs === "number" &&
    Number.isFinite(value.latencyMs) &&
    typeof value.requestId === "string" &&
    isNullableString(value.errorMessage) &&
    typeof value.createdAt === "string"
  );
}

function formatTime(value: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unavailable"
    : `${date.toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

function keyStatus(key: PublicApiKeyRecord) {
  if (key.status === "revoked") return "Revoked";
  if (key.expiresAt && new Date(key.expiresAt).getTime() <= Date.now()) return "Expired";
  return "Active";
}

async function requestAdminApi(init: RequestInit = {}): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch("/api/admin/public-api", {
      ...init,
      cache: "no-store",
      credentials: "same-origin",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new Error("The request could not be completed. Check your connection and session.");
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = isObject(payload) && typeof payload.error === "string" && payload.error.trim()
      ? payload.error
      : `Request failed (HTTP ${response.status}).`;
    throw new Error(
      response.status === 401 || response.status === 403
        ? `${message} Sign in with an organization admin account.`
        : message
    );
  }
  if (!isObject(payload)) {
    throw new Error("The server returned an invalid JSON response.");
  }
  return payload;
}

export function PublicApiConsole({ initialKeys, initialRequestLogs, scopes }: Props) {
  const [keys, setKeys] = useState(initialKeys);
  const [requestLogs, setRequestLogs] = useState(initialRequestLogs);
  const [availableScopes, setAvailableScopes] = useState<readonly Scope[]>(scopes);
  const [selectedScopes, setSelectedScopes] = useState<Scope[]>(
    scopes.includes("opportunities:read") ? ["opportunities:read"] : []
  );
  const [name, setName] = useState("");
  const [rateLimit, setRateLimit] = useState("60");
  const [expiresAt, setExpiresAt] = useState("");
  // Only the creation response supplies this value; never persist or put it in a URL.
  const [issuedSecret, setIssuedSecret] = useState<IssuedSecret | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const inFlight = useRef(false);
  const nameInput = useRef<HTMLInputElement>(null);

  async function runAction(action: PendingAction, work: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(action);
    setError(null);
    setMessage(null);
    try {
      await work();
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : "The request could not be completed.";
      const recovery = action.kind === "create"
        ? " Refresh the key list before trying again: a key may have been created. Revoke it if its secret was not received."
        : action.kind === "revoke"
          ? " Refresh the key list to confirm whether revocation completed."
          : " Your previously loaded data is still shown.";
      setError(`${detail}${recovery}`);
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }

  async function refresh() {
    await runAction({ kind: "refresh" }, async () => {
      const payload = await requestAdminApi();
      if (
        !isObject(payload) ||
        !Array.isArray(payload.keys) || !payload.keys.every(isKey) ||
        !Array.isArray(payload.requestLogs) || !payload.requestLogs.every(isRequestLog) ||
        !Array.isArray(payload.scopes) || !payload.scopes.every(isScope)
      ) {
        throw new Error("The server returned an unexpected key list.");
      }
      const nextScopes = payload.scopes;
      const nextKeys = payload.keys;
      setKeys(nextKeys);
      setRequestLogs(payload.requestLogs);
      setAvailableScopes(nextScopes);
      setSelectedScopes((current) => current.filter((scope) => nextScopes.includes(scope)));
      setConfirmRevokeId(null);
      setIssuedSecret((current) => current && nextKeys.some(
        (key) => key.id === current.keyId && keyStatus(key) === "Active"
      ) ? current : null);
      setMessage("Keys and recent requests refreshed.");
    });
  }

  async function createKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || issuedSecret) return;
    setError(null);
    setMessage(null);

    const rateLimitPerMinute = Number(rateLimit);
    const expiration = expiresAt ? new Date(expiresAt) : null;
    if (!name.trim()) {
      setError("Enter a name for this integration key.");
      return;
    }
    if (!selectedScopes.length || selectedScopes.some((scope) => !availableScopes.includes(scope))) {
      setError("Select at least one available read-only scope.");
      return;
    }
    if (!Number.isSafeInteger(rateLimitPerMinute) || rateLimitPerMinute < 1) {
      setError("The per-minute limit must be a positive whole number.");
      return;
    }
    if (expiration && (Number.isNaN(expiration.getTime()) || expiration.getTime() <= Date.now())) {
      setError("Choose a valid expiration time in the future, or leave it blank.");
      return;
    }

    await runAction({ kind: "create" }, async () => {
      const payload = await requestAdminApi({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          scopes: selectedScopes,
          rateLimitPerMinute,
          ...(expiration ? { expiresAt: expiration.toISOString() } : {}),
        }),
      });
      if (!isObject(payload) || !isKey(payload.key) || typeof payload.secret !== "string" || !payload.secret) {
        throw new Error("The server did not return a valid key and one-time secret.");
      }
      const key = payload.key;
      setKeys((current) => [key, ...current.filter((item) => item.id !== key.id)]);
      setIssuedSecret({ keyId: key.id, name: key.name, value: payload.secret });
      setName("");
      setExpiresAt("");
      setConfirmRevokeId(null);
      setMessage("Key created. Store its secret securely before dismissing it.");
    });
  }

  async function revokeKey(key: PublicApiKeyRecord) {
    if (confirmRevokeId !== key.id) return;
    await runAction({ kind: "revoke", keyId: key.id }, async () => {
      const payload = await requestAdminApi({
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ keyId: key.id }),
      });
      if (!isObject(payload) || payload.ok !== true) {
        throw new Error("The server did not confirm revocation.");
      }
      setKeys((current) => current.map((item) => item.id === key.id
        ? { ...item, status: "revoked", revokedAt: new Date().toISOString() }
        : item));
      setIssuedSecret((current) => current?.keyId === key.id ? null : current);
      setConfirmRevokeId(null);
      setMessage(`Key "${key.name}" revoked. Integrations must use a different active key.`);
    });
  }

  return (
    <div className="page-stack" style={{ minWidth: 0 }}>
      <section className="panel" aria-labelledby="public-api-title">
        <div className="section-header">
          <div>
            <p className="eyebrow">Admin console</p>
            <h1 className="detail-title" id="public-api-title">Public API</h1>
            <p className="tight-copy">
              Manage scoped integration keys and recent API requests for your organization.
              Access is read-only: the public-source opportunity catalog is shared, while notes,
              memos, and private workflow data are excluded.
            </p>
          </div>
          <button className="button button-secondary" type="button" disabled={pending !== null} onClick={refresh}>
            {pending?.kind === "refresh" ? "Refreshing..." : "Refresh keys and requests"}
          </button>
        </div>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {message ? <p className="success-message" role="status">{message}</p> : null}
      </section>

      {issuedSecret ? (
        <section className="panel settings-card" aria-labelledby="issued-secret-title">
          <div>
            <p className="eyebrow">Shown once</p>
            <h2 className="section-title" id="issued-secret-title">Save the secret for {issuedSecret.name}</h2>
            <p className="tight-copy" id="issued-secret-help">
              Store this secret in your integration&apos;s secret manager. It cannot be retrieved
              after dismissal, navigation, or a page reload. This console does not save it in browser storage.
            </p>
          </div>
          <label className="field">
            <span className="field-label">API key secret</span>
            <input
              className="field-input"
              type="text"
              value={issuedSecret.value}
              readOnly
              autoFocus
              autoComplete="off"
              spellCheck={false}
              aria-describedby="issued-secret-help"
              onFocus={(event) => event.currentTarget.select()}
            />
          </label>
          <button className="button" type="button" onClick={() => {
            setIssuedSecret(null);
            setMessage("Secret dismissed. Only the key identifier remains available.");
            nameInput.current?.focus();
          }}>
            I have saved the secret. Dismiss
          </button>
        </section>
      ) : null}

      <section className="panel settings-card" aria-labelledby="create-key-title">
        <div>
          <p className="eyebrow">New integration</p>
          <h2 className="section-title" id="create-key-title">Create an organization key</h2>
          <p className="tight-copy">Use a separate key per integration and grant only the scopes it needs.</p>
        </div>
        <form className="settings-card" onSubmit={createKey} aria-busy={pending?.kind === "create"}>
          <div className="form-grid">
            <label className="field">
              <span className="field-label">Key name</span>
              <input
                ref={nameInput}
                className="field-input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Warehouse sync - production"
                required
                disabled={pending !== null}
              />
            </label>
            <label className="field">
              <span className="field-label">Requests per minute</span>
              <input
                className="field-input"
                type="number"
                min={1}
                step={1}
                value={rateLimit}
                onChange={(event) => setRateLimit(event.target.value)}
                required
                disabled={pending !== null}
              />
            </label>
            <label className="field">
              <span className="field-label">Expires at (optional, your local time)</span>
              <input
                className="field-input"
                type="datetime-local"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
                disabled={pending !== null}
                aria-describedby="key-expiration-help"
              />
              <span className="subtle-text" id="key-expiration-help">
                Leave blank for no expiration. Dates in the tables are shown in UTC.
              </span>
            </label>
          </div>
          <fieldset
            className="settings-toggle-stack"
            disabled={pending !== null}
            style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
          >
            <legend className="field-label">Read-only scopes</legend>
            {availableScopes.map((scope) => (
              <label className="settings-toggle" key={scope}>
                <div style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                  <span>{scope}</span>
                  <div className="table-subtext">{scopeDescriptions[scope]}</div>
                </div>
                <input
                  type="checkbox"
                  checked={selectedScopes.includes(scope)}
                  onChange={(event) => setSelectedScopes((current) => event.target.checked
                    ? [...current, scope]
                    : current.filter((item) => item !== scope))}
                />
              </label>
            ))}
          </fieldset>
          {availableScopes.length === 0 ? <p className="form-error">No scopes are available. Refresh to try again.</p> : null}
          {issuedSecret ? <p className="subtle-text">Save and dismiss the current secret before creating another key.</p> : null}
          <button
            className="button"
            type="submit"
            disabled={pending !== null || issuedSecret !== null || !availableScopes.length}
          >
            {pending?.kind === "create" ? "Creating key..." : "Create API key"}
          </button>
        </form>
      </section>

      <section className="panel" aria-labelledby="api-keys-title" aria-busy={pending !== null}>
        <div className="section-header">
          <div>
            <p className="eyebrow">Credentials</p>
            <h2 className="section-title" id="api-keys-title">Organization keys</h2>
          </div>
          <div className="subtle-text">{keys.length} keys</div>
        </div>
        {keys.length === 0 ? (
          <p className="tight-copy">No API keys yet. Create a scoped key to connect your first integration.</p>
        ) : (
          <div role="region" aria-label="Organization API keys" tabIndex={0} style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Key</th>
                  <th scope="col">Scopes</th>
                  <th scope="col">Status</th>
                  <th scope="col">Limit / expiry</th>
                  <th scope="col">Activity</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => (
                  <tr key={key.id}>
                    <td>
                      <strong style={{ overflowWrap: "anywhere" }}>{key.name}</strong>
                      <div className="table-subtext"><code>{key.keyPrefix}...{key.keyLast4}</code></div>
                      <div className="table-subtext" style={{ overflowWrap: "anywhere" }}>{key.id}</div>
                    </td>
                    <td>{key.scopes.map((scope) => <div className="table-subtext" key={scope}>{scope}</div>)}</td>
                    <td>
                      {keyStatus(key)}
                      {key.revokedAt ? <div className="table-subtext">Revoked {formatTime(key.revokedAt)}</div> : null}
                    </td>
                    <td>
                      {key.rateLimitPerMinute} / minute
                      <div className="table-subtext">{key.expiresAt ? `Expires ${formatTime(key.expiresAt)}` : "No expiration"}</div>
                    </td>
                    <td>
                      <div className="table-subtext">Created {formatTime(key.createdAt)}</div>
                      <div className="table-subtext">Last used: {formatTime(key.lastUsedAt)}</div>
                    </td>
                    <td>
                      {key.status === "revoked" ? "No actions" : confirmRevokeId === key.id ? (
                        <div className="button-stack">
                          <p className="tight-copy">Revoke &quot;{key.name}&quot;? This cannot be undone and stops access for this key.</p>
                          <button className="button" type="button" disabled={pending !== null} onClick={() => revokeKey(key)}>
                            {pending?.kind === "revoke" && pending.keyId === key.id ? "Revoking..." : "Confirm revoke"}
                          </button>
                          <button className="button button-secondary" type="button" disabled={pending !== null} onClick={() => setConfirmRevokeId(null)}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          className="button button-secondary"
                          type="button"
                          disabled={pending !== null}
                          aria-label={`Revoke key ${key.name}`}
                          onClick={() => setConfirmRevokeId(key.id)}
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel" aria-labelledby="api-requests-title" aria-busy={pending?.kind === "refresh"}>
        <div className="section-header">
          <div>
            <p className="eyebrow">Usage</p>
            <h2 className="section-title" id="api-requests-title">Recent requests</h2>
            <p className="tight-copy">Refresh to load recent activity. This is a recent sample, not a complete usage or billing report.</p>
          </div>
          <div className="subtle-text">{requestLogs.length} requests</div>
        </div>
        {requestLogs.length === 0 ? (
          <p className="tight-copy">No requests recorded for this organization yet.</p>
        ) : (
          <div role="region" aria-label="Recent public API requests" tabIndex={0} style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Time</th>
                  <th scope="col">Key</th>
                  <th scope="col">Request</th>
                  <th scope="col">Status</th>
                  <th scope="col">Latency</th>
                  <th scope="col">Request ID / error</th>
                </tr>
              </thead>
              <tbody>
                {requestLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatTime(log.createdAt)}</td>
                    <td style={{ overflowWrap: "anywhere" }}>
                      {keys.find((key) => key.id === log.apiKeyId)?.name ?? log.apiKeyId ?? "Unattributed"}
                    </td>
                    <td style={{ overflowWrap: "anywhere" }}>{log.method} <code>{log.route}</code></td>
                    <td>{log.statusCode}</td>
                    <td>{log.latencyMs} ms</td>
                    <td style={{ overflowWrap: "anywhere" }}>
                      <code>{log.requestId}</code>
                      {log.errorMessage ? <div className="table-subtext">{log.errorMessage}</div> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
