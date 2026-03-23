import type { DailyBriefing } from "@/lib/domain/types";

export interface BriefingRow {
  signal_date: string;
  day_mode: string;
  synopsis: string;
  primary_recommendation: string;
  warning: string;
  scores: DailyBriefing["scores"];
  windows: DailyBriefing["windows"];
  suggested_moves: string[];
  recalibration_triggers: string[];
  end_of_day_prompts: string[];
}

export function rowToBriefing(row: BriefingRow): DailyBriefing {
  return {
    dayMode: row.day_mode as DailyBriefing["dayMode"],
    synopsis: row.synopsis,
    primaryRecommendation: row.primary_recommendation,
    warning: row.warning,
    scores: row.scores,
    windows: row.windows,
    suggestedMoves: row.suggested_moves,
    recalibrationTriggers: row.recalibration_triggers,
    endOfDayPrompts: row.end_of_day_prompts,
  };
}

/**
 * Returns true if the briefing's signal_date is before today.
 * Both arguments must be YYYY-MM-DD strings.
 */
export function isBriefingStale(signalDate: string, today: string): boolean {
  return signalDate < today;
}
