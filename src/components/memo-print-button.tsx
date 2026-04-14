"use client";

export function MemoPrintButton() {
  return (
    <button
      className="button button-secondary"
      onClick={() => window.print()}
      type="button"
    >
      Print / Export
    </button>
  );
}
