"use client";

import { useState } from "react";

type PilotRequestFormState = {
  name: string;
  email: string;
  company: string;
  role: string;
  marketFocus: string;
  teamSize: string;
  notes: string;
};

const defaultState: PilotRequestFormState = {
  name: "",
  email: "",
  company: "",
  role: "",
  marketFocus: "",
  teamSize: "",
  notes: "",
};

export function PilotRequestForm() {
  const [form, setForm] = useState<PilotRequestFormState>(defaultState);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/pilot", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Pilot request failed. Please try again.");
        return;
      }

      setSuccess("Thanks — your pilot request is in. We’ll follow up with next steps.");
      setForm(defaultState);
    } catch {
      setError("Pilot request failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="panel pilot-form" onSubmit={handleSubmit}>
      <div className="section-header panel-header">
        <div>
          <p className="eyebrow">Request access</p>
          <h2 className="section-title">Tell us what pilot you want to run</h2>
        </div>
      </div>

      <div className="pilot-form-grid">
        <label className="field">
          <span className="field-label">Name</span>
          <input
            className="field-input"
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Your name"
            required
            type="text"
            value={form.name}
          />
        </label>

        <label className="field">
          <span className="field-label">Work email</span>
          <input
            className="field-input"
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            placeholder="you@firm.com"
            required
            type="email"
            value={form.email}
          />
        </label>

        <label className="field">
          <span className="field-label">Company</span>
          <input
            className="field-input"
            onChange={(event) =>
              setForm((current) => ({ ...current, company: event.target.value }))
            }
            placeholder="Company name"
            required
            type="text"
            value={form.company}
          />
        </label>

        <label className="field">
          <span className="field-label">Role</span>
          <input
            className="field-input"
            onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
            placeholder="Acquisitions, development, research..."
            type="text"
            value={form.role}
          />
        </label>

        <label className="field">
          <span className="field-label">Market focus</span>
          <input
            className="field-input"
            onChange={(event) =>
              setForm((current) => ({ ...current, marketFocus: event.target.value }))
            }
            placeholder="Market or region you care about"
            type="text"
            value={form.marketFocus}
          />
        </label>

        <label className="field">
          <span className="field-label">Team size</span>
          <input
            className="field-input"
            onChange={(event) =>
              setForm((current) => ({ ...current, teamSize: event.target.value }))
            }
            placeholder="Ex: 4 person acquisitions team"
            type="text"
            value={form.teamSize}
          />
        </label>
      </div>

      <label className="field">
        <span className="field-label">Pilot goals</span>
        <textarea
          className="field-input pilot-notes"
          onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
          placeholder="Describe the sourcing workflow, market, or signal problem you want to test."
          required
          rows={5}
          value={form.notes}
        />
      </label>

      {error ? <p className="form-error">{error}</p> : null}
      {success ? <p className="pilot-success">{success}</p> : null}

      <div className="hero-action-row">
        <button className="button" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Submitting..." : "Request pilot access"}
        </button>
      </div>
    </form>
  );
}
