import { pickNumber } from "@/lib/ingestion/providers/helpers";
import type { WearableSnapshot } from "@/lib/ingestion/types";

const OURA_BASE_URL = "https://api.ouraring.com/v2";

async function ouraGet<T>(accessToken: string, path: string): Promise<T> {
  const response = await fetch(`${OURA_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Oura request failed (${response.status}): ${details}`);
  }

  return (await response.json()) as T;
}

function firstDataRecord(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null;
  const data = (payload as { data?: unknown[] }).data;
  if (!Array.isArray(data) || data.length === 0) return null;
  const first = data[0];
  return first && typeof first === "object" ? (first as Record<string, unknown>) : null;
}

export async function fetchOuraSnapshot(accessToken: string, date: string): Promise<WearableSnapshot> {
  const query = `?start_date=${date}&end_date=${date}`;
  const [sleepRaw, readinessRaw] = await Promise.all([
    ouraGet<unknown>(accessToken, `/usercollection/daily_sleep${query}`),
    ouraGet<unknown>(accessToken, `/usercollection/daily_readiness${query}`),
  ]);

  const sleep = firstDataRecord(sleepRaw);
  const readiness = firstDataRecord(readinessRaw);
  const sleepDurationSeconds = pickNumber(sleep, ["contributors.total_sleep", "total_sleep_duration"]);

  return {
    recoveryScore: pickNumber(readiness, ["score", "contributors.recovery_index"]),
    sleepHours: sleepDurationSeconds ? sleepDurationSeconds / 3600 : undefined,
    sleepEfficiency: pickNumber(sleep, ["efficiency"]),
    sleepQuality: pickNumber(sleep, ["score"]),
    hrv: pickNumber(readiness, ["contributors.hrv_balance", "hrv_balance"]),
    restingHeartRate: pickNumber(sleep, ["lowest_heart_rate"]),
  };
}
