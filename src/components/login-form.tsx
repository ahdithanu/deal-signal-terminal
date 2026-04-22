"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type LoginFormProps = {
  demoCredentials: {
    email: string;
    password: string;
    orgName: string;
  } | null;
};

export function LoginForm({ demoCredentials }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function readErrorMessage(response: Response): Promise<string | null> {
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

    try {
      if (contentType.includes("application/json")) {
        const payload = (await response.json()) as { error?: unknown };
        return typeof payload.error === "string" ? payload.error : null;
      }

      const text = await response.text();
      const trimmed = text.trim();

      if (!trimmed) {
        return null;
      }

      // Collapse HTML or framework error bodies into a user-facing fallback.
      if (trimmed.startsWith("<!DOCTYPE html") || trimmed.startsWith("<html")) {
        return null;
      }

      return trimmed;
    } catch {
      return null;
    }
  }

  async function submitLogin(nextEmail: string, nextPassword: string, redirectToDemo = false) {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: nextEmail, password: nextPassword }),
      });

      if (!response.ok) {
        const responseError = await readErrorMessage(response);
        throw new Error(responseError ?? "Login failed. Check the server logs or deployment env settings.");
      }

      router.push(redirectToDemo ? "/?demo=1" : "/");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitLogin(email, password);
  }

  async function handleDemoLogin() {
    if (!demoCredentials) {
      return;
    }

    setEmail(demoCredentials.email);
    setPassword(demoCredentials.password);
    await submitLogin(demoCredentials.email, demoCredentials.password, true);
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      {demoCredentials ? (
        <button className="button demo-button" disabled={isSubmitting} onClick={handleDemoLogin} type="button">
          {isSubmitting ? "Opening demo workspace..." : "Use demo workspace"}
        </button>
      ) : null}

      <label className="field">
        <span className="field-label">Email</span>
        <input
          autoComplete="email"
          className="field-input"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@firm.com"
          type="email"
          value={email}
        />
      </label>

      <label className="field">
        <span className="field-label">Password</span>
        <input
          autoComplete="current-password"
          className="field-input"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter your password"
          type="password"
          value={password}
        />
      </label>

      {error ? <p className="form-error">{error}</p> : null}

      <button className="button button-secondary" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
