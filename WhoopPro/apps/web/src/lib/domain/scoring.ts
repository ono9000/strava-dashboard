import type { DailySignals, DimensionScores } from "@/lib/domain/types";

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function normalize(value: number, min: number, max: number): number {
  if (value <= min) return 0;
  if (value >= max) return 100;
  return ((value - min) / (max - min)) * 100;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function trainingIntentModifier(intent: DailySignals["trainingIntent"]): number {
  switch (intent) {
    case "rest":
      return 6;
    case "light":
      return 3;
    case "moderate":
      return 0;
    case "intense":
      return -5;
    default:
      return 0;
  }
}

function objectiveModifier(objective: DailySignals["objective"]): number {
  switch (objective) {
    case "performance":
      return 3;
    case "balance":
      return 0;
    case "recovery":
      return -4;
    case "consistency":
      return 1;
    default:
      return 0;
  }
}

export function computeDimensionScores(signals: DailySignals): DimensionScores {
  const sleepDurationScore = normalize(signals.sleepHours, 5.25, 8.5);
  const strainLoad = normalize(signals.strainYesterday, 0, 21);
  const hrvScore = clamp(50 + signals.hrvTrend * 50);
  const hrPenalty = clamp(normalize(signals.restingHrDelta, 0, 12));
  const meetingLoad = clamp(normalize(signals.meetingsPlanned, 0, 8));
  const focusCommitment = clamp(normalize(signals.focusBlocksPlanned, 0, 4));

  const recoveryBase = average([
    signals.recoveryScore,
    signals.sleepQuality,
    signals.sleepEfficiency,
    sleepDurationScore,
    hrvScore,
  ]);

  const fatiguePressure = average([
    100 - signals.recoveryScore,
    strainLoad,
    signals.stressLoad,
    hrPenalty,
    signals.travelLoad,
    signals.decisionLoad,
  ]);

  const deepWorkReadiness = clamp(
    recoveryBase * 0.36 +
      signals.mentalFreshness * 0.28 +
      (100 - signals.stressLoad) * 0.14 +
      (100 - meetingLoad) * 0.1 +
      (100 - signals.travelLoad) * 0.08 +
      focusCommitment * 0.04 +
      objectiveModifier(signals.objective),
  );

  const meetingReadiness = clamp(
    signals.socialBattery * 0.33 +
      recoveryBase * 0.24 +
      (100 - signals.stressLoad) * 0.16 +
      (100 - signals.decisionLoad) * 0.08 +
      (100 - meetingLoad) * 0.06 +
      signals.mentalFreshness * 0.13,
  );

  const executionCapacity = clamp(
    recoveryBase * 0.3 +
      signals.mentalFreshness * 0.22 +
      (100 - signals.stressLoad) * 0.2 +
      (100 - signals.decisionLoad) * 0.12 +
      focusCommitment * 0.1 +
      (100 - signals.travelLoad) * 0.06,
  );

  const physicalReadiness = clamp(
    recoveryBase * 0.36 +
      (100 - strainLoad) * 0.22 +
      (100 - hrPenalty) * 0.14 +
      (100 - signals.stressLoad) * 0.12 +
      (100 - signals.travelLoad) * 0.1 +
      trainingIntentModifier(signals.trainingIntent),
  );

  const recoveryProtection = clamp(
    fatiguePressure * 0.76 +
      (100 - signals.socialBattery) * 0.12 +
      (100 - signals.mentalFreshness) * 0.12,
  );

  return {
    deepWorkReadiness: Math.round(deepWorkReadiness),
    meetingReadiness: Math.round(meetingReadiness),
    executionCapacity: Math.round(executionCapacity),
    physicalReadiness: Math.round(physicalReadiness),
    recoveryProtection: Math.round(recoveryProtection),
  };
}
