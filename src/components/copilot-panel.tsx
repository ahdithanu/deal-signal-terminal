"use client";

import { useState, useTransition } from "react";

import type { CopilotCitation, CopilotResponse } from "@/types/copilot";

type CopilotPanelProps = {
  opportunitySlug?: string;
  visibleOpportunitySlugs?: string[];
  title?: string;
};

type Message = {
  id: string;
  question: string;
  response: CopilotResponse;
};

const promptPresets = [
  "Why does this opportunity matter?",
  "Explain the score with evidence.",
  "Compare the strongest opportunities.",
  "What should we do next?",
  "Draft an executive memo.",
];

function CitationDrawer({ citations }: { citations: CopilotCitation[] }) {
  if (!citations.length) {
    return <p className="subtle-text">No citations were available for this response.</p>;
  }

  return (
    <div className="copilot-citation-stack">
      {citations.map((citation) => (
        <div className="copilot-citation-card" key={citation.id}>
          <div className="copilot-citation-header">
            <strong>{citation.label}</strong>
            <span>{citation.sourceType}</span>
          </div>
          <p>{citation.excerpt}</p>
          {citation.url ? (
            <a href={citation.url} target={citation.url.startsWith("/") ? undefined : "_blank"}>
              Open source
            </a>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function CopilotPanel({
  opportunitySlug,
  visibleOpportunitySlugs,
  title = "Ask Build Signals Copilot",
}: CopilotPanelProps) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const selectedMessage = messages.find((message) => message.id === selectedMessageId) ?? messages.at(-1);

  function ask(nextQuestion = question) {
    const trimmedQuestion = nextQuestion.trim();

    if (!trimmedQuestion) {
      setError("Ask a specific Build Signals workflow question.");
      return;
    }

    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: trimmedQuestion,
          opportunitySlug,
          visibleOpportunitySlugs,
        }),
      });
      const payload = (await response.json()) as CopilotResponse | { error?: string };

      if (!response.ok) {
        setError("error" in payload ? payload.error ?? "Copilot request failed." : "Copilot request failed.");
        return;
      }

      const copilotResponse = payload as CopilotResponse;
      const message = {
        id: copilotResponse.id,
        question: trimmedQuestion,
        response: copilotResponse,
      };

      setMessages((current) => [...current, message]);
      setSelectedMessageId(message.id);
      setQuestion("");
    });
  }

  return (
    <section className="panel copilot-panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">AI Copilot</p>
          <h2 className="section-title">{title}</h2>
          <p className="tight-copy">
            Ask evidence-backed workflow questions. The Copilot cites sources and refuses to fill
            missing facts with guesses.
          </p>
        </div>
        <div className="subtle-text">{messages.length} answer(s)</div>
      </div>

      <div className="chip-row">
        {promptPresets.map((preset) => (
          <button
            className="chip chip-button"
            key={preset}
            onClick={() => ask(preset)}
            type="button"
          >
            {preset}
          </button>
        ))}
      </div>

      <div className="feed-question-row">
        <input
          className="field-input"
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              ask();
            }
          }}
          placeholder="Ask why it matters, compare opportunities, or request the next action"
          value={question}
        />
        <button className="button" disabled={isPending} onClick={() => ask()} type="button">
          {isPending ? "Working..." : "Ask Copilot"}
        </button>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="copilot-layout">
        <div className="copilot-thread">
          {messages.length === 0 ? (
            <div className="empty-state-inline">
              <p className="tight-copy">
                Start with a question like “explain the score” or “what should we do next?”
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <button
                className={`copilot-message${message.id === selectedMessage?.id ? " copilot-message-active" : ""}`}
                key={message.id}
                onClick={() => setSelectedMessageId(message.id)}
                type="button"
              >
                <span>{message.question}</span>
                <strong>{message.response.intent.replaceAll("_", " ")}</strong>
                <p>{message.response.directAnswer}</p>
                <small>
                  {message.response.confidence} confidence · {message.response.citations.length} citation(s)
                  {message.response.refused ? " · refused" : ""}
                </small>
              </button>
            ))
          )}
        </div>

        <aside className="copilot-citations">
          <p className="eyebrow">Citation drawer</p>
          <h3 className="section-title">Evidence used</h3>
          {selectedMessage ? (
            <>
              <CitationDrawer citations={selectedMessage.response.citations} />
              <div className="copilot-next-actions">
                <p className="copy-label">Suggested next actions</p>
                <ul className="plain-list plain-list-tight">
                  {selectedMessage.response.suggestedNextActions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>
              <div className="copilot-next-actions">
                <p className="copy-label">Assumptions</p>
                <ul className="plain-list plain-list-tight">
                  {selectedMessage.response.assumptions.map((assumption) => (
                    <li key={assumption}>{assumption}</li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <p className="subtle-text">Ask a question to inspect cited evidence.</p>
          )}
        </aside>
      </div>
    </section>
  );
}
