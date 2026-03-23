import { buildDailyBriefing } from "@/lib/domain/briefing";
import type { DailySignals } from "@/lib/domain/types";
import { syncTodaySignalsForUser } from "@/lib/ingestion/sync-today";
import { inngest } from "@/lib/inngest/client";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getTodayDateInTimeZone } from "@/lib/time/timezone";

interface DailySignalsRecord {
  signal_date: string;
  objective: DailySignals["objective"];
  chronotype: DailySignals["chronotype"];
  training_intent: DailySignals["trainingIntent"];
  recovery_score: number;
  sleep_hours: number;
  sleep_efficiency: number;
  sleep_quality: number;
  strain_yesterday: number;
  hrv_trend: number;
  resting_hr_delta: number;
  stress_load: number;
  social_battery: number;
  mental_freshness: number;
  meetings_planned: number;
  focus_blocks_planned: number;
  decision_load: number;
  travel_load: number;
}
interface ProfileRecord {
  user_id: string;
  timezone: string | null;
}

function mapRecordToSignals(record: DailySignalsRecord, timezone: string): DailySignals {
  return {
    date: record.signal_date,
    timezone,
    chronotype: record.chronotype,
    objective: record.objective,
    recoveryScore: record.recovery_score,
    sleepHours: Number(record.sleep_hours),
    sleepEfficiency: record.sleep_efficiency,
    sleepQuality: record.sleep_quality,
    strainYesterday: Number(record.strain_yesterday),
    hrvTrend: Number(record.hrv_trend),
    restingHrDelta: Number(record.resting_hr_delta),
    stressLoad: record.stress_load,
    socialBattery: record.social_battery,
    mentalFreshness: record.mental_freshness,
    meetingsPlanned: record.meetings_planned,
    focusBlocksPlanned: record.focus_blocks_planned,
    decisionLoad: record.decision_load,
    travelLoad: record.travel_load,
    trainingIntent: record.training_intent,
  };
}

export const scheduleDailyBriefings = inngest.createFunction(
  {
    id: "schedule-daily-briefings",
    triggers: [{ cron: "0 6 * * *" }],
  },
  async ({ step }) => {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.from("profiles").select("user_id, timezone");

    if (error) {
      throw new Error(`Unable to read profiles for scheduling: ${error.message}`);
    }

    const profiles = (data ?? []) as ProfileRecord[];

    for (const profile of profiles) {
      await step.sendEvent(`enqueue-briefing-${profile.user_id}`, {
        name: "briefing/generate.user",
        data: {
          userId: profile.user_id,
          timezone: profile.timezone ?? "UTC",
        },
      });
    }

    return { enqueued: profiles.length };
  },
);

export const generateBriefingForUser = inngest.createFunction(
  {
    id: "generate-briefing-for-user",
    retries: 2,
    triggers: [{ event: "briefing/generate.user" }],
  },
  async ({ event, step }) => {
    const payload = event.data as { userId?: string; timezone?: string };
    const userId = payload.userId;

    if (!userId) {
      return { skipped: true, reason: "Missing userId in event payload." };
    }

    const timezone = payload.timezone ?? "UTC";
    const signalDate = getTodayDateInTimeZone(timezone);
    const supabase = getSupabaseAdminClient();

    await step.run("sync-today-signals", async () => {
      return syncTodaySignalsForUser({ userId, timezone });
    });

    const dailySignals = await step.run("load-daily-signals", async () => {
      const { data, error } = await supabase
        .from("daily_signals")
        .select(
          "signal_date, objective, chronotype, training_intent, recovery_score, sleep_hours, sleep_efficiency, sleep_quality, strain_yesterday, hrv_trend, resting_hr_delta, stress_load, social_battery, mental_freshness, meetings_planned, focus_blocks_planned, decision_load, travel_load",
        )
        .eq("user_id", userId)
        .eq("signal_date", signalDate)
        .maybeSingle();

      if (error) {
        throw new Error(`Unable to read daily signals: ${error.message}`);
      }

      return data as DailySignalsRecord | null;
    });

    if (!dailySignals) {
      return {
        skipped: true,
        reason: `No daily signals found for ${signalDate}.`,
      };
    }

    const briefing = await step.run("compute-briefing", async () => {
      const input = mapRecordToSignals(dailySignals, timezone);
      return buildDailyBriefing(input);
    });

    await step.run("persist-briefing", async () => {
      const { error } = await supabase.from("daily_briefings").upsert(
        {
          user_id: userId,
          signal_date: signalDate,
          day_mode: briefing.dayMode,
          synopsis: briefing.synopsis,
          primary_recommendation: briefing.primaryRecommendation,
          warning: briefing.warning,
          scores: briefing.scores,
          windows: briefing.windows,
          suggested_moves: briefing.suggestedMoves,
          recalibration_triggers: briefing.recalibrationTriggers,
          end_of_day_prompts: briefing.endOfDayPrompts,
        },
        { onConflict: "user_id,signal_date" },
      );

      if (error) {
        throw new Error(`Unable to persist daily briefing: ${error.message}`);
      }
    });

    return {
      ok: true,
      signalDate,
      userId,
    };
  },
);
