import { pickNumber } from "@/lib/ingestion/providers/helpers";
import type { WearableSnapshot } from "@/lib/ingestion/types";

const WHOOP_BASE_URL = "https://api.prod.whoop.com/developer/v2";

async function whoopGet<T>(accessToken: string, path: string): Promise<T> {
  const response = await fetch(`${WHOOP_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`WHOOP request failed (${response.status}): ${details}`);
  }

  return (await response.json()) as T;
}

function getFirstRecord(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null;
  const records = (payload as { records?: unknown[] }).records;
  if (!Array.isArray(records) || records.length === 0) return null;
  const first = records[0];
  return first && typeof first === "object" ? (first as Record<string, unknown>) : null;
}

export async function fetchWhoopSnapshot(accessToken: string): Promise<WearableSnapshot> {
  const [recoveryRaw, sleepRaw, cycleRaw] = await Promise.all([
    whoopGet<unknown>(accessToken, "/recovery?limit=1"),
    whoopGet<unknown>(accessToken, "/activity/sleep?limit=1"),
    whoopGet<unknown>(accessToken, "/cycle?limit=1"),
  ]);

  const recovery = getFirstRecord(recoveryRaw);
  const sleep = getFirstRecord(sleepRaw);
  const cycle = getFirstRecord(cycleRaw);

  return {
    recoveryScore: pickNumber(recovery, ["score.recovery_score", "score.recoveryScore"]),
    sleepHours:
      (pickNumber(sleep, [
        "score.stage_summary.total_in_bed_time_milli",
        "score.stage_summary.total_sleep_time_milli",
      ]) ?? 0) / 3_600_000 || undefined,
    sleepEfficiency: pickNumber(sleep, ["score.sleep_efficiency_percentage", "score.sleep_performance_percentage"]),
    sleepQuality: pickNumber(sleep, ["score.sleep_performance_percentage", "score.sleep_consistency_percentage"]),
    strainYesterday: pickNumber(cycle, ["score.strain"]),
    hrv: pickNumber(recovery, ["score.hrv_rmssd_milli"]),
    restingHeartRate: pickNumber(recovery, ["score.resting_heart_rate"]),
  };
}
