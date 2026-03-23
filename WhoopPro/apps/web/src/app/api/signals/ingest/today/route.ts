import { NextRequest, NextResponse } from "next/server";
import { resolveUserIdFromRequest } from "@/lib/auth/request-user";
import { syncTodaySignalsForUser } from "@/lib/ingestion/sync-today";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = await resolveUserIdFromRequest(request);

  if (!userId) {
    return NextResponse.json(
      {
        error:
          "Unauthorized. Provide Authorization: Bearer <supabase_access_token> or define DEV_USER_ID for local mode.",
      },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { timezone?: string };

  try {
    const result = await syncTodaySignalsForUser({
      userId,
      timezone: body.timezone,
    });

    return NextResponse.json({
      ok: true,
      userId,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to sync signals.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
