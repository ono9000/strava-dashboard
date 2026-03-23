import Link from "next/link";

export const metadata = {
  title: "Axial Day \u2014 Energy Architecture for High-Performers",
};

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-5 py-20 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
        Personal Operating System
      </p>
      <h1 className="display-font mt-4 max-w-3xl text-5xl leading-tight text-[var(--foreground)] sm:text-6xl">
        Your calendar knows what exists.
        <br />
        This engine decides when it makes sense.
      </h1>
      <p className="mt-6 max-w-xl text-base leading-relaxed text-[color-mix(in_srgb,var(--foreground)_72%,white)]">
        Axial Day converts your physiological state, agenda, and goals into a daily briefing that tells you what to do, when to do it, and what to protect.
      </p>
      <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
        <Link
          href="/signup"
          className="rounded-xl bg-[var(--accent)] px-8 py-3 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] transition-colors"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-8 py-3 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
