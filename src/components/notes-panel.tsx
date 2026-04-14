"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "deal-signal-terminal.notes";

type NoteRecord = {
  body: string;
  savedAt: string;
};

function parseNotesMap(value: string | null): Record<string, NoteRecord> {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, NoteRecord] =>
          typeof entry[0] === "string" &&
          !!entry[1] &&
          typeof entry[1] === "object" &&
          typeof entry[1].body === "string" &&
          typeof entry[1].savedAt === "string"
      )
    );
  } catch {
    return {};
  }
}

export function NotesPanel({ opportunityId }: { opportunityId: string }) {
  const [note, setNote] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    try {
      const parsed = parseNotesMap(window.localStorage.getItem(STORAGE_KEY));
      if (parsed[opportunityId]) {
        setNote(parsed[opportunityId].body);
        setSavedAt(parsed[opportunityId].savedAt);
      } else {
        setNote("");
        setSavedAt(null);
      }
    } finally {
      setIsReady(true);
    }
  }, [opportunityId]);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY) {
        return;
      }

      const parsed = parseNotesMap(event.newValue);
      if (parsed[opportunityId]) {
        setNote(parsed[opportunityId].body);
        setSavedAt(parsed[opportunityId].savedAt);
      } else {
        setNote("");
        setSavedAt(null);
      }
    }

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [opportunityId]);

  function handleChange(nextValue: string) {
    setNote(nextValue);
    const nextSavedAt = new Date().toISOString();
    setSavedAt(nextSavedAt);

    try {
      const parsed = parseNotesMap(window.localStorage.getItem(STORAGE_KEY));

      parsed[opportunityId] = {
        body: nextValue,
        savedAt: nextSavedAt,
      };

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    } catch {
      // Ignore local storage failures and keep the textarea usable.
    }
  }

  return (
    <div className="panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">Notes</p>
          <h3 className="section-title">Working notes</h3>
        </div>
      <div className="subtle-text">
        {savedAt && isReady ? `Saved ${new Date(savedAt).toLocaleTimeString()}` : "Local only"}
      </div>
      </div>
      <textarea
        className="note-field"
        onChange={(event) => handleChange(event.target.value)}
        placeholder="Capture broker names, diligence calls, underwriting questions, or reasons to pass."
        rows={8}
        value={note}
      />
    </div>
  );
}
