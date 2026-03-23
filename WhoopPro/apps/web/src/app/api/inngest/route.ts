import { serve } from "inngest/next";
import { generateBriefingForUser, scheduleDailyBriefings } from "@/lib/inngest/functions";
import { inngest } from "@/lib/inngest/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [scheduleDailyBriefings, generateBriefingForUser],
});
