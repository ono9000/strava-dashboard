import { NextRequest, NextResponse } from "next/server";
import { buildDailyBriefing } from "@/lib/domain/briefing";
import { scenarioInputs } from "@/lib/domain/scenarios";
import type { DailySignals } from "@/lib/domain/types";

export const dynamic = "force-dynamic";

const requiredNumberFields: Array<keyof DailySignals> = [
  "recoveryScore",
  "sleepHours",
  "sleepEfficiency",
  "sleepQuality",
  "strainYesterday",
  "hrvTrend",
  "restingHrDelta",
  "stressLoad",
  "socialBattery",
  "mentalFreshness",
  "meetingsPlanned",
  "focusBlocksPlanned",
  "decisionLoad",
  "travelLoad",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseSignals(payload: unknown): DailySignals | null {
  if (!isRecord(payload)) return null;

  const base = payload as Partial<DailySignals>;

  if (
    typeof base.date !== "string" ||
    typeof base.timezone !== "string" ||
    (base.chronotype !== "morning" &&
      base.chronotype !== "balanced" &&
      base.chronotype !== "evening") ||
    (base.objective !== "performance" &&
      base.objective !== "balance" &&
      base.objective !== "recovery" &&
      base.objective !== "consistency") ||
    (base.trainingIntent !== "rest" &&
      base.trainingIntent !== "light" &&
      base.trainingIntent !== "moderate" &&
      base.trainingIntent !== "intense")
  ) {
    return null;
  }

  for (const key of requiredNumberFields) {
    if (typeof base[key] !== "number" || Number.isNaN(base[key])) {
      return null;
    }
  }

  return base as DailySignals;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const scenario = request.nextUrl.searchParams.get("scenario") ?? "strategic";
  const input = scenarioInputs[scenario];

  if (!input) {
    return NextResponse.json(
      {
        error: "Unknown scenario",
        validScenarios: Object.keys(scenarioInputs),
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    scenario,
    input,
    briefing: buildDailyBriefing(input),
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body. Provide a DailySignals payload." },
      { status: 400 },
    );
  }

  const input = parseSignals(body);

  if (!input) {
    return NextResponse.json(
      {
        error: "Invalid DailySignals payload.",
        requiredFields: [
          "date",
          "timezone",
          "chronotype",
          "objective",
          "trainingIntent",
          ...requiredNumberFields,
        ],
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    briefing: buildDailyBriefing(input),
  });
}
