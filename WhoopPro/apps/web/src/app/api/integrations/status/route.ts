import { NextRequest, NextResponse } from "next/server";
import { resolveUserIdFromRequest } from "@/lib/auth/request-user";
import { listIntegrationStatus } from "@/lib/integrations/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
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
    const integrations = await listIntegrationStatus(userId);
    return NextResponse.json({
      userId,
      integrations,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch integration status.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
