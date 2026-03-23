import { NextRequest, NextResponse } from "next/server";
import { resolveUserIdFromRequest } from "@/lib/auth/request-user";
import { inngest } from "@/lib/inngest/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as { timezone?: string };
  const userId = await resolveUserIdFromRequest(request);

  if (!userId) {
    return NextResponse.json(
      {
        error:
          "Unauthorized. Provide Authorization: Bearer <supabase_access_token> or set DEV_USER_ID for local mode.",
      },
      { status: 401 },
    );
  }

  try {
    await inngest.send({
      name: "briefing/generate.user",
      data: {
        userId,
        timezone: body.timezone ?? "UTC",
      },
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to queue briefing generation event.",
        details,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, queued: true, userId });
}
