"use client";

import { useEffect, useRef, useState } from "react";

import type { NoteRecord } from "@/types/domain";

function isNoteRecord(value: unknown): value is NoteRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const note = value as Partial<NoteRecord>;
  return typeof note.body === "string" && typeof note.savedAt === "string";
}

async function loadNote(opportunityId: string): Promise<NoteRecord | null> {
  const response = await fetch(`/api/notes?opportunityId=${encodeURIComponent(opportunityId)}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to load note.");
  }

  const data = await response.json();
  return isNoteRecord(data) ? data : null;
}

export function NotesPanel({ opportunityId }: { opportunityId: string }) {
  const [note, setNote] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let isActive = true;

    loadNote(opportunityId)
      .then((record) => {
        if (!isActive) {
          return;
        }

        setNote(record?.body ?? "");
        setSavedAt(record?.savedAt ?? null);
      })
      .catch(() => {
        if (!isActive) {
          return;
        }

        setNote("");
        setSavedAt(null);
      })
      .finally(() => {
        if (isActive) {
          setIsReady(true);
        }
      });

    return () => {
      isActive = false;
    };
  }, [opportunityId]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function handleNoteSync(event: Event) {
      const detail = (event as CustomEvent<{ opportunityId: string; note: NoteRecord | null }>).detail;

      if (!detail || detail.opportunityId !== opportunityId) {
        return;
      }

      setNote(detail.note?.body ?? "");
      setSavedAt(detail.note?.savedAt ?? null);
    }

    window.addEventListener("deal-signal-terminal:note-sync", handleNoteSync);

    return () => {
      window.removeEventListener("deal-signal-terminal:note-sync", handleNoteSync);
    };
  }, [opportunityId]);

  function handleChange(nextValue: string) {
    setNote(nextValue);

    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/notes", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            opportunityId,
            body: nextValue,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to save note.");
        }

        const record = await response.json();
        const nextRecord = isNoteRecord(record) ? record : null;
        setSavedAt(nextRecord?.savedAt ?? null);

        window.dispatchEvent(
          new CustomEvent("deal-signal-terminal:note-sync", {
            detail: {
              opportunityId,
              note: nextRecord,
            },
          })
        );
      } catch {
        // Keep the textarea usable even if persistence is unavailable.
      }
    }, 500);
  }

  return (
    <div className="panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">Notes</p>
          <h3 className="section-title">Working notes</h3>
        </div>
        <div className="subtle-text">
          {savedAt && isReady ? `Saved ${new Date(savedAt).toLocaleTimeString()}` : "Server-backed"}
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
