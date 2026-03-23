import type { DailySignals } from "@/lib/domain/types";
import { clamp } from "@/lib/ingestion/providers/helpers";
import { fetchGoogleCalendarSnapshot } from "@/lib/ingestion/providers/google-calendar";
import { fetchOuraSnapshot } from "@/lib/ingestion/providers/oura";
import { fetchWhoopSnapshot } from "@/lib/ingestion/providers/whoop";
import type { CalendarSnapshot, IngestionResult, WearableSnapshot } from "@/lib/ingestion/types";
import { refreshAccessToken, type IntegrationProvider } from "@/lib/integrations/oauth";
import {
  getIntegrationCredentials,
  touchIntegrationSync,
  updateIntegrationTokenAfterRefresh,
} from "@/lib/integrations/repository";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getDayRangeInTimeZone } from "@/lib/time/timezone";

interface SyncSignalsOptions {
  userId: string;
  timezone?: string;
}

interface ProfileRow {
  objective: DailySignals["objective"] | null;
  chronotype: DailySignals["chronotype"] | null;
  timezone: string | null;
}

interface GoogleEvent {
  id?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  location?: string;
}

function pickFirstDefined(values: Array<number | undefined>, fallback: number): number {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return fallback;
}

function defaultCalendarSnapshot(): CalendarSnapshot {
  return {
    meetingsCount: 0,
    focusBlocksPlanned: 2,
    decisionLoad: 30,
    travelLoad: 0,
    socialHeavyMeetings: 0,
  };
}

function inferTrainingIntent(objective: DailySignals["objective"]): DailySignals["trainingIntent"] {
  if (objective === "recovery") return "rest";
  if (objective === "balance") return "light";
  return "moderate";
}

function buildDailySignals(params: {
  date: string;
  timezone: string;
  objective: DailySignals["objective"];
  chronotype: DailySignals["chronotype"];
  wearable: WearableSnapshot;
  calendar: CalendarSnapshot;
}): DailySignals {
  const { date, timezone, objective, chronotype, wearable, calendar } = params;

  const recoveryScore = clamp(Math.round(pickFirstDefined([wearable.recoveryScore], 58)), 0, 100);
  const sleepHours = clamp(Number(pickFirstDefined([wearable.sleepHours], 7.0).toFixed(2)), 3.5, 10);
  const sleepEfficiency = clamp(Math.round(pickFirstDefined([wearable.sleepEfficiency], 82)), 50, 100);
  const sleepQuality = clamp(Math.round(pickFirstDefined([wearable.sleepQuality], recoveryScore * 0.92)), 35, 100);
  const strainYesterday = clamp(Number(pickFirstDefined([wearable.strainYesterday], 9.8).toFixed(2)), 0, 21);
  const hrv = pickFirstDefined([wearable.hrv], 55);
  const restingHeartRate = pickFirstDefined([wearable.restingHeartRate], 55);
  const hrvTrend = Number(((hrv - 55) / 55).toFixed(2));
  const restingHrDelta = Number((restingHeartRate - 55).toFixed(2));
  const stressLoad = clamp(
    Math.round(calendar.decisionLoad * 0.42 + calendar.socialHeavyMeetings * 7 + (100 - recoveryScore) * 0.33),
    0,
    100,
  );
  const socialBattery = clamp(Math.round(recoveryScore * 0.52 - calendar.meetingsCount * 6 + 44), 0, 100);
  const mentalFreshness = clamp(
    Math.round(recoveryScore * 0.45 + sleepQuality * 0.32 + calendar.focusBlocksPlanned * 5 - stressLoad * 0.26),
    0,
    100,
  );

  return {
    date,
    timezone,
    objective,
    chronotype,
    recoveryScore,
    sleepHours,
    sleepEfficiency,
    sleepQuality,
    strainYesterday,
    hrvTrend,
    restingHrDelta,
    stressLoad,
    socialBattery,
    mentalFreshness,
    meetingsPlanned: calendar.meetingsCount,
    focusBlocksPlanned: calendar.focusBlocksPlanned,
    decisionLoad: calendar.decisionLoad,
    travelLoad: calendar.travelLoad,
    trainingIntent: inferTrainingIntent(objective),
  };
}

function isUnauthorizedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("401") || message.includes("unauthorized") || message.includes("invalid token");
}

function parseEventDateTime(value?: string): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T00:00:00.000Z`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

async function runWithCredentialRefresh<T>(params: {
  userId: string;
  provider: IntegrationProvider;
  run: (accessToken: string) => Promise<T>;
}): Promise<T | null> {
  const { userId, provider, run } = params;
  const credentials = await getIntegrationCredentials(userId, provider);
  if (!credentials) return null;

  try {
    const result = await run(credentials.accessToken);
    await touchIntegrationSync(userId, provider);
    return result;
  } catch (error) {
    if (!credentials.refreshToken || !isUnauthorizedError(error)) {
      throw error;
    }

    const refreshed = await refreshAccessToken(provider, credentials.refreshToken);
    await updateIntegrationTokenAfterRefresh({ userId, provider, token: refreshed });
    const result = await run(refreshed.access_token);
    await touchIntegrationSync(userId, provider);
    return result;
  }
}

async function persistCalendarEvents(params: {
  userId: string;
  date: string;
  events: GoogleEvent[];
}): Promise<void> {
  const { userId, date, events } = params;
  if (events.length === 0) return;

  const supabase = getSupabaseAdminClient();
  const heavyKeywords = ["strategy", "interview", "board", "review", "negotiation", "decision", "hiring"];

  const rows = events
    .map((event) => {
      const startsAt = parseEventDateTime(event.start?.dateTime ?? event.start?.date);
      const endsAt = parseEventDateTime(event.end?.dateTime ?? event.end?.date);
      if (!startsAt || !endsAt) return null;

      const title = event.summary ?? "Untitled";
      const normalizedTitle = title.toLowerCase();

      return {
        user_id: userId,
        signal_date: date,
        source_event_id: event.id ?? `${startsAt}-${title}`,
        title,
        starts_at: startsAt,
        ends_at: endsAt,
        is_high_stakes: heavyKeywords.some((keyword) => normalizedTitle.includes(keyword)),
        is_socially_heavy: Boolean(event.start?.dateTime),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (rows.length === 0) return;

  const { error } = await supabase.from("calendar_events").upsert(rows, { onConflict: "user_id,source_event_id" });
  if (error) {
    throw new Error(`Failed to persist calendar events: ${error.message}`);
  }
}

export async function syncTodaySignalsForUser(options: SyncSignalsOptions): Promise<IngestionResult> {
  const supabase = getSupabaseAdminClient();
  const profileResult = await supabase
    .from("profiles")
    .select("objective, chronotype, timezone")
    .eq("user_id", options.userId)
    .maybeSingle();

  if (profileResult.error) {
    throw new Error(`Failed to load user profile: ${profileResult.error.message}`);
  }

  const profile = (profileResult.data ?? {}) as ProfileRow;
  const timezone = options.timezone ?? profile.timezone ?? "UTC";
  const objective = profile.objective ?? "performance";
  const chronotype = profile.chronotype ?? "balanced";

  const dayRange = getDayRangeInTimeZone(timezone);
  const source: string[] = [];
  const warnings: string[] = [];

  let whoopSnapshot: WearableSnapshot | null = null;
  try {
    whoopSnapshot = await runWithCredentialRefresh({
      userId: options.userId,
      provider: "whoop",
      run: (accessToken) => fetchWhoopSnapshot(accessToken),
    });
    if (whoopSnapshot) source.push("whoop");
  } catch (error) {
    warnings.push(`whoop: ${error instanceof Error ? error.message : "sync failed"}`);
  }

  let ouraSnapshot: WearableSnapshot | null = null;
  try {
    ouraSnapshot = await runWithCredentialRefresh({
      userId: options.userId,
      provider: "oura",
      run: (accessToken) => fetchOuraSnapshot(accessToken, dayRange.date),
    });
    if (ouraSnapshot) source.push("oura");
  } catch (error) {
    warnings.push(`oura: ${error instanceof Error ? error.message : "sync failed"}`);
  }

  let googleCalendar: Awaited<ReturnType<typeof fetchGoogleCalendarSnapshot>> | null = null;
  try {
    googleCalendar = await runWithCredentialRefresh({
      userId: options.userId,
      provider: "google",
      run: (accessToken) => fetchGoogleCalendarSnapshot(accessToken, dayRange.startIso, dayRange.endIso),
    });
    if (googleCalendar) {
      source.push("google_calendar");
      await persistCalendarEvents({
        userId: options.userId,
        date: dayRange.date,
        events: googleCalendar.events as GoogleEvent[],
      });
    }
  } catch (error) {
    warnings.push(`google_calendar: ${error instanceof Error ? error.message : "sync failed"}`);
  }

  const wearable: WearableSnapshot = {
    recoveryScore: pickFirstDefined([whoopSnapshot?.recoveryScore, ouraSnapshot?.recoveryScore], 58),
    sleepHours: pickFirstDefined([whoopSnapshot?.sleepHours, ouraSnapshot?.sleepHours], 7),
    sleepEfficiency: pickFirstDefined([whoopSnapshot?.sleepEfficiency, ouraSnapshot?.sleepEfficiency], 82),
    sleepQuality: pickFirstDefined([whoopSnapshot?.sleepQuality, ouraSnapshot?.sleepQuality], 70),
    strainYesterday: pickFirstDefined([whoopSnapshot?.strainYesterday], 9.5),
    hrv: pickFirstDefined([whoopSnapshot?.hrv, ouraSnapshot?.hrv], 55),
    restingHeartRate: pickFirstDefined([whoopSnapshot?.restingHeartRate, ouraSnapshot?.restingHeartRate], 55),
  };

  const calendar = googleCalendar?.calendar ?? defaultCalendarSnapshot();
  const signals = buildDailySignals({
    date: dayRange.date,
    timezone,
    objective,
    chronotype,
    wearable,
    calendar,
  });

  const { error } = await supabase.from("daily_signals").upsert(
    {
      user_id: options.userId,
      signal_date: signals.date,
      objective: signals.objective,
      chronotype: signals.chronotype,
      training_intent: signals.trainingIntent,
      recovery_score: signals.recoveryScore,
      sleep_hours: signals.sleepHours,
      sleep_efficiency: signals.sleepEfficiency,
      sleep_quality: signals.sleepQuality,
      strain_yesterday: signals.strainYesterday,
      hrv_trend: signals.hrvTrend,
      resting_hr_delta: signals.restingHrDelta,
      stress_load: signals.stressLoad,
      social_battery: signals.socialBattery,
      mental_freshness: signals.mentalFreshness,
      meetings_planned: signals.meetingsPlanned,
      focus_blocks_planned: signals.focusBlocksPlanned,
      decision_load: signals.decisionLoad,
      travel_load: signals.travelLoad,
    },
    { onConflict: "user_id,signal_date" },
  );

  if (error) {
    throw new Error(`Failed to upsert daily signals: ${error.message}`);
  }

  return {
    signalDate: dayRange.date,
    source,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
