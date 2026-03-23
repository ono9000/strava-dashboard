"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

interface GenerateBriefingButtonProps {
  timezone: string;
}

type State = "idle" | "loading" | "queued" | "error";

export function GenerateBriefingButton({ timezone }: GenerateBriefingButtonProps) {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleGenerate() {
    setState("loading");
    setErrorMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        setErrorMessage("Session expired. Please sign in again.");
        setState("error");
        return;
      }

      const response = await fetch("/api/briefing/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ timezone }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { error?: string };
        setErrorMessage(data.error ?? "Failed to queue briefing generation.");
        setState("error");
        return;
      }

      setState("queued");
    } catch {
      setErrorMessage("Network error. Please try again.");
      setState("error");
    }
  }

  if (state === "queued") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[var(--ok)]">
          Your briefing is being generated. Refresh in a moment.
        </p>
        <button
          onClick={() => router.refresh()}
          className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-5 py-2.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors"
        >
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {state === "error" && errorMessage && (
        <p className="text-sm text-[var(--warning)]">{errorMessage}</p>
      )}
      <button
        onClick={handleGenerate}
        disabled={state === "loading"}
        className="rounded-xl bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-60 transition-colors"
      >
        {state === "loading" ? "Generating…" : "Generate today's briefing"}
      </button>
    </div>
  );
}
