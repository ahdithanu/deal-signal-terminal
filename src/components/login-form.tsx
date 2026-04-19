"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Login failed.");
      }

      router.push("/");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
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

      <button className="button" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
