import { computeDimensionScores } from "@/lib/domain/scoring";
import type {
  DailyBriefing,
  DailySignals,
  DayMode,
  DimensionScores,
  TimeWindow,
} from "@/lib/domain/types";

function inferDayMode(scores: DimensionScores): DayMode {
  if (scores.recoveryProtection >= 72 && scores.deepWorkReadiness <= 52) {
    return "Recovery-first";
  }

  if (scores.deepWorkReadiness >= 74 && scores.executionCapacity >= 68) {
    return "Strategic";
  }

  if (scores.executionCapacity >= 66 && scores.meetingReadiness >= 58) {
    return "Focused";
  }

  if (scores.recoveryProtection >= 60) {
    return "Low-reserve";
  }

  return "Execution-stable";
}

function makeWindows(signals: DailySignals, scores: DimensionScores): TimeWindow[] {
  const morningDeepWindow =
    signals.chronotype === "morning"
      ? { start: "08:15", end: "11:15" }
      : signals.chronotype === "evening"
        ? { start: "10:30", end: "13:00" }
        : { start: "09:00", end: "11:45" };

  const meetingWindow =
    scores.meetingReadiness >= 65
      ? { start: "12:15", end: "15:00" }
      : { start: "11:30", end: "13:30" };

  const trainingWindow =
    scores.physicalReadiness >= 68
      ? { start: "16:30", end: "18:00" }
      : { start: "17:30", end: "18:30" };

  const dipWindow =
    signals.chronotype === "evening"
      ? { start: "14:00", end: "15:30" }
      : { start: "15:30", end: "17:00" };

  return [
    {
      kind: "deep-work",
      start: morningDeepWindow.start,
      end: morningDeepWindow.end,
      confidence: scores.deepWorkReadiness,
      rationale: "Highest cognitive quality window for strategic and creative tasks.",
    },
    {
      kind: "meetings",
      start: meetingWindow.start,
      end: meetingWindow.end,
      confidence: scores.meetingReadiness,
      rationale: "Best balance between social tolerance and decision precision.",
    },
    {
      kind: "training",
      start: trainingWindow.start,
      end: trainingWindow.end,
      confidence: scores.physicalReadiness,
      rationale: "Suggested movement slot aligned with physical readiness.",
    },
    {
      kind: "delicate-zone",
      start: dipWindow.start,
      end: dipWindow.end,
      confidence: Math.round((100 - scores.recoveryProtection + scores.executionCapacity) / 2),
      rationale: "Expected energy drop; avoid high-stakes decisions or conflict conversations.",
    },
    {
      kind: "shutdown",
      start: "20:45",
      end: "21:30",
      confidence: Math.round(100 - scores.recoveryProtection * 0.4),
      rationale: "Close loops and lower stimulation to protect tomorrow's readiness.",
    },
  ];
}

function primaryRecommendation(mode: DayMode): string {
  switch (mode) {
    case "Strategic":
      return "Protect the first cognitive window for one hard problem and avoid context switching.";
    case "Focused":
      return "Batch operational work before noon, then keep meetings structured and short.";
    case "Execution-stable":
      return "Prioritize closure over expansion: finish existing threads before opening new ones.";
    case "Low-reserve":
      return "Move complex decisions to tomorrow and convert the afternoon into maintenance mode.";
    case "Recovery-first":
      return "Run a preservation day: reduce load, keep only critical commitments, and stop early.";
    default:
      return "Align your hardest task with your strongest window and protect recovery.";
  }
}

function synopsis(mode: DayMode): string {
  switch (mode) {
    case "Strategic":
      return "High-clarity day with good reserve for deep reasoning and selective meetings.";
    case "Focused":
      return "Solid execution profile. You can advance the day if workload is sequenced carefully.";
    case "Execution-stable":
      return "Balanced but not peak. Good for disciplined progress and reliable delivery.";
    case "Low-reserve":
      return "Capacity is limited. Smart pacing will outperform force and multitasking.";
    case "Recovery-first":
      return "Today is about protection. Preserve cognitive and physical reserves deliberately.";
    default:
      return "Use intentional sequencing to match output with your state.";
  }
}

function warning(mode: DayMode, scores: DimensionScores): string {
  if (mode === "Recovery-first" || mode === "Low-reserve") {
    return "Do not place critical decisions after 17:00.";
  }

  if (scores.meetingReadiness < 52) {
    return "Social tolerance is below baseline; keep strategic conversations short and prepared.";
  }

  return "Your vulnerable zone is late afternoon. Protect it from ad-hoc work.";
}

function suggestedMoves(mode: DayMode): string[] {
  switch (mode) {
    case "Strategic":
      return [
        "Use one uninterrupted 120-minute block for top-priority thinking.",
        "Defer low-value admin to the final hour.",
        "Keep one protected gap before your key meeting for preparation.",
      ];
    case "Focused":
      return [
        "Cluster tactical tasks into two execution sprints.",
        "Limit meetings to agendas with explicit decisions.",
        "Keep an early evening shutdown to avoid spillover fatigue.",
      ];
    case "Execution-stable":
      return [
        "Start with hard-but-finite tasks to secure momentum.",
        "Use a strict inbox block instead of constant checking.",
        "Avoid opening new projects after 16:00.",
      ];
    case "Low-reserve":
      return [
        "Cancel or shorten non-essential meetings.",
        "Trade complex writing for review and closure work.",
        "Prioritize walking or light mobility over intense training.",
      ];
    case "Recovery-first":
      return [
        "Keep only non-negotiable commitments.",
        "Replace training intensity with active recovery.",
        "Finish work earlier and reduce evening stimulation.",
      ];
    default:
      return [];
  }
}

export function buildDailyBriefing(signals: DailySignals): DailyBriefing {
  const scores = computeDimensionScores(signals);
  const dayMode = inferDayMode(scores);

  return {
    dayMode,
    synopsis: synopsis(dayMode),
    primaryRecommendation: primaryRecommendation(dayMode),
    warning: warning(dayMode, scores),
    scores,
    windows: makeWindows(signals, scores),
    suggestedMoves: suggestedMoves(dayMode),
    recalibrationTriggers: [
      "Unexpected conflict or emotionally expensive conversation.",
      "Two consecutive blocks with delayed completion.",
      "Stress spike after lunch or sleepiness earlier than expected.",
    ],
    endOfDayPrompts: [
      "Which block delivered your best thinking quality today?",
      "Where did the schedule fight your real energy state?",
      "What should be moved tomorrow based on today's pattern?",
    ],
  };
}
