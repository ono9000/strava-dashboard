import type { DailyBriefing, WindowKind } from "@/lib/domain/types";
import { GenerateBriefingButton } from "@/components/GenerateBriefingButton";

const scoreLabels: Array<{
  key: keyof DailyBriefing["scores"];
  label: string;
  invert?: boolean;
}> = [
  { key: "deepWorkReadiness", label: "Deep Work Readiness" },
  { key: "meetingReadiness", label: "Meeting Readiness" },
  { key: "executionCapacity", label: "Execution Capacity" },
  { key: "physicalReadiness", label: "Physical Readiness" },
  { key: "recoveryProtection", label: "Recovery Protection", invert: true },
];

const kindLabel: Record<WindowKind, string> = {
  "deep-work": "Deep Work Window",
  meetings: "Meeting Window",
  training: "Training Window",
  "delicate-zone": "Energy Dip Zone",
  shutdown: "Shutdown Window",
};

function scoreTone(score: number, invert = false): string {
  const value = invert ? 100 - score : score;
  if (value >= 70) return "text-[var(--ok)]";
  if (value >= 45) return "text-[var(--accent-strong)]";
  return "text-[var(--warning)]";
}

interface BriefingViewProps {
  briefing: DailyBriefing;
  staleDate?: string;
  timezone: string;
}

export function BriefingView({ briefing, staleDate, timezone }: BriefingViewProps) {
  return (
    <div className="flex flex-col gap-6">
      {staleDate && (
        <div className="rounded-2xl border border-[var(--warning)] bg-[color-mix(in_srgb,var(--warning)_8%,white)] px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--warning)]">
            This briefing is from {staleDate}. Generate a new one to get today&apos;s plan.
          </p>
          <GenerateBriefingButton timezone={timezone} />
        </div>
      )}

      <section className="panel rise-in rounded-3xl px-6 py-7 sm:px-8 sm:py-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
              Axial Day — Executive Briefing
            </p>
            <h1 className="display-font max-w-3xl text-4xl leading-tight text-[var(--foreground)] sm:text-5xl">
              Your calendar knows what exists.
              <br />
              This engine decides when it makes sense.
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-[color-mix(in_srgb,var(--foreground)_78%,white)] sm:text-base">
              Today mode: <strong>{briefing.dayMode}</strong>. {briefing.synopsis}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent-strong)]">Main call</p>
            <p className="mt-2 max-w-xs text-sm font-medium leading-relaxed text-[var(--foreground)]">
              {briefing.primaryRecommendation}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="panel rise-in rounded-3xl p-6 sm:p-7">
          <header className="flex items-center justify-between">
            <h2 className="display-font text-2xl text-[var(--foreground)]">Energy Architecture</h2>
            <span className="text-xs uppercase tracking-[0.15em] text-[var(--accent-strong)]">5 dimensions</span>
          </header>
          <div className="mt-5 space-y-5">
            {scoreLabels.map(({ key, label, invert }) => {
              const value = briefing.scores[key];
              const progress = invert ? 100 - value : value;
              return (
                <div key={key} className="space-y-2">
                  <div className="flex items-end justify-between gap-2">
                    <p className="text-sm font-medium text-[var(--foreground)]">{label}</p>
                    <p className={`text-sm font-semibold ${scoreTone(value, invert)}`}>{value}/100</p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--line)_50%,white)]">
                    <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--warning)]">Risk guardrail</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--foreground)]">{briefing.warning}</p>
          </div>
        </article>

        <article className="panel rise-in rounded-3xl p-6 sm:p-7">
          <header className="flex items-center justify-between">
            <h2 className="display-font text-2xl text-[var(--foreground)]">Optimal Windows</h2>
            <span className="text-xs uppercase tracking-[0.15em] text-[var(--accent-strong)]">local time</span>
          </header>
          <div className="mt-5 space-y-3">
            {briefing.windows.map((window) => (
              <div key={window.kind} className="rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[var(--foreground)]">{kindLabel[window.kind]}</p>
                  <p className="text-sm text-[var(--accent-strong)]">{window.start} - {window.end}</p>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[color-mix(in_srgb,var(--foreground)_76%,white)]">{window.rationale}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="panel rise-in rounded-3xl p-6 sm:p-7">
          <header className="flex items-center justify-between">
            <h2 className="display-font text-2xl text-[var(--foreground)]">Suggested Moves</h2>
          </header>
          <ul className="mt-5 space-y-3">
            {briefing.suggestedMoves.map((move, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-[var(--foreground)]">
                <span className="mt-0.5 shrink-0 text-[var(--accent)]">→</span>
                {move}
              </li>
            ))}
          </ul>
        </article>

        <article className="panel rise-in rounded-3xl p-6 sm:p-7">
          <header className="flex items-center justify-between">
            <h2 className="display-font text-2xl text-[var(--foreground)]">Adaptive Loop</h2>
          </header>
          <div className="mt-5 space-y-4">
            {briefing.recalibrationTriggers.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--warning)]">Recalibration triggers</p>
                <ul className="mt-2 space-y-2">
                  {briefing.recalibrationTriggers.map((trigger, i) => (
                    <li key={i} className="text-sm leading-relaxed text-[var(--foreground)]">• {trigger}</li>
                  ))}
                </ul>
              </div>
            )}
            {briefing.endOfDayPrompts.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--accent-strong)]">End-of-day prompts</p>
                <ul className="mt-2 space-y-2">
                  {briefing.endOfDayPrompts.map((prompt, i) => (
                    <li key={i} className="text-sm leading-relaxed text-[var(--foreground)]">• {prompt}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
