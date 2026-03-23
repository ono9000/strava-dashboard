"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

interface AuthFormProps {
  mode: "login" | "signup";
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasOAuthError = searchParams.get("error") === "auth_failed";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = getSupabaseBrowserClient();

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { setError(error.message); return; }
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) { setError(error.message); return; }
      }
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      },
    });
  }

  return (
    <div className="panel rise-in mx-auto w-full max-w-sm rounded-3xl p-8">
      <p className="display-font text-2xl font-semibold text-[var(--foreground)]">
        {mode === "login" ? "Sign in" : "Get started"}
      </p>
      <p className="mt-1 text-sm text-[color-mix(in_srgb,var(--foreground)_70%,white)]">
        {mode === "login" ? "Welcome back to Axial Day." : "Create your Axial Day account."}
      </p>

      {hasOAuthError && (
        <div className="mt-4 rounded-xl border border-[var(--warning)] bg-[color-mix(in_srgb,var(--warning)_8%,white)] px-4 py-3">
          <p className="text-sm text-[var(--warning)]">Authentication failed. Please try again.</p>
        </div>
      )}

      <button
        type="button"
        onClick={handleGoogle}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors"
      >
        Continue with Google
      </button>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-[var(--line)]" />
        <span className="text-xs text-[color-mix(in_srgb,var(--foreground)_50%,white)]">or</span>
        <div className="h-px flex-1 bg-[var(--line)]" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[var(--foreground)] mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--foreground)] mb-1">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>

        {error && (
          <p className="text-sm text-[var(--warning)]">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-60 transition-colors"
        >
          {loading ? "Please wait\u2026" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-[color-mix(in_srgb,var(--foreground)_60%,white)]">
        {mode === "login" ? (
          <>No account? <a href="/signup" className="underline">Sign up</a></>
        ) : (
          <>Already have an account? <a href="/login" className="underline">Sign in</a></>
        )}
      </p>
    </div>
  );
}
