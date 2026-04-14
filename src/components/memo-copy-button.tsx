"use client";

import { useEffect, useRef, useState } from "react";

export function MemoCopyButton({ memo }: { memo: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "unavailable">("idle");
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }

      await navigator.clipboard.writeText(memo);
      setStatus("copied");
    } catch {
      setStatus("unavailable");
    }

    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      setStatus("idle");
    }, 1600);
  }

  return (
    <button className="button button-secondary" onClick={handleCopy} type="button">
      {status === "copied"
        ? "Copied"
        : status === "unavailable"
          ? "Copy unavailable"
          : "Copy memo"}
    </button>
  );
}
