import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTodayDateInTimeZone } from "@/lib/time/timezone";
import { rowToBriefing, isBriefingStale, type BriefingRow } from "@/lib/dashboard/briefing-data";
import { BriefingView } from "@/components/BriefingView";
import { EmptyBriefingState } from "@/components/EmptyBriefingState";

interface ProfileRow {
  timezone: string | null;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Load timezone from profile
  const { data: profileData } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("user_id", user.id)
    .maybeSingle();

  const profile = (profileData ?? {}) as ProfileRow;
  const timezone = profile.timezone ?? "UTC";
  const today = getTodayDateInTimeZone(timezone);

  // Fetch most recent briefing
  const { data: briefingData, error } = await supabase
    .from("daily_briefings")
    .select(
      "signal_date, day_mode, synopsis, primary_recommendation, warning, scores, windows, suggested_moves, recalibration_triggers, end_of_day_prompts"
    )
    .eq("user_id", user.id)
    .order("signal_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return (
      <div className="panel rounded-3xl px-6 py-8 text-center">
        <p className="text-sm text-[var(--warning)]">
          Something went wrong loading your briefing. Try refreshing.
        </p>
      </div>
    );
  }

  if (!briefingData) {
    return <EmptyBriefingState timezone={timezone} />;
  }

  const row = briefingData as BriefingRow;
  const briefing = rowToBriefing(row);
  const stale = isBriefingStale(row.signal_date, today);

  return (
    <BriefingView
      briefing={briefing}
      staleDate={stale ? row.signal_date : undefined}
      timezone={timezone}
    />
  );
}
