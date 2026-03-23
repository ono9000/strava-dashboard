export type Chronotype = "morning" | "balanced" | "evening";

export type TrainingIntent = "rest" | "light" | "moderate" | "intense";

export type Objective = "performance" | "balance" | "recovery" | "consistency";

export type DayMode =
  | "Strategic"
  | "Focused"
  | "Execution-stable"
  | "Low-reserve"
  | "Recovery-first";

export interface DailySignals {
  date: string;
  timezone: string;
  chronotype: Chronotype;
  objective: Objective;
  recoveryScore: number;
  sleepHours: number;
  sleepEfficiency: number;
  sleepQuality: number;
  strainYesterday: number;
  hrvTrend: number;
  restingHrDelta: number;
  stressLoad: number;
  socialBattery: number;
  mentalFreshness: number;
  meetingsPlanned: number;
  focusBlocksPlanned: number;
  decisionLoad: number;
  travelLoad: number;
  trainingIntent: TrainingIntent;
}

export interface DimensionScores {
  deepWorkReadiness: number;
  meetingReadiness: number;
  executionCapacity: number;
  physicalReadiness: number;
  recoveryProtection: number;
}

export type WindowKind =
  | "deep-work"
  | "meetings"
  | "training"
  | "delicate-zone"
  | "shutdown";

export interface TimeWindow {
  kind: WindowKind;
  start: string;
  end: string;
  confidence: number;
  rationale: string;
}

export interface DailyBriefing {
  dayMode: DayMode;
  synopsis: string;
  primaryRecommendation: string;
  warning: string;
  scores: DimensionScores;
  windows: TimeWindow[];
  suggestedMoves: string[];
  recalibrationTriggers: string[];
  endOfDayPrompts: string[];
}
