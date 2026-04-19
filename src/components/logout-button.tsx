"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogout() {
    setIsSubmitting(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
      router.push("/login");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <button className="nav-link nav-link-button" disabled={isSubmitting} onClick={handleLogout} type="button">
      {isSubmitting ? "Signing out..." : "Sign out"}
    </button>
  );
}
