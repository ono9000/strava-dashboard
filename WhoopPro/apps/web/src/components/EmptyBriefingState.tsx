import { GenerateBriefingButton } from "@/components/GenerateBriefingButton";

interface EmptyBriefingStateProps {
  timezone: string;
}

export function EmptyBriefingState({ timezone }: EmptyBriefingStateProps) {
  return (
    <div className="panel rise-in rounded-3xl px-6 py-10 sm:px-8 sm:py-12 text-center">
      <p className="display-font text-2xl text-[var(--foreground)]">No briefing yet today</p>
      <p className="mt-3 max-w-sm mx-auto text-sm leading-relaxed text-[color-mix(in_srgb,var(--foreground)_70%,white)]">
        Connect WHOOP or Google Calendar to get a personalized briefing, or generate one now using your profile defaults.
      </p>
      <div className="mt-8 flex justify-center">
        <GenerateBriefingButton timezone={timezone} />
      </div>
    </div>
  );
}
