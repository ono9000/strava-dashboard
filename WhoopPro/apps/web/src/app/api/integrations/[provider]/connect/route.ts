import { NextRequest, NextResponse } from "next/server";
import { resolveUserIdFromRequest } from "@/lib/auth/request-user";
import { buildAuthorizationUrl, isIntegrationProvider } from "@/lib/integrations/oauth";
import {
  createOAuthStatePayload,
  encodeStatePayload,
  OAUTH_STATE_COOKIE,
} from "@/lib/integrations/state";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  const { provider: providerValue } = await params;

  if (!isIntegrationProvider(providerValue)) {
    return NextResponse.json({ error: "Unsupported provider." }, { status: 400 });
  }

  const userId = await resolveUserIdFromRequest(request);

  if (!userId) {
    return NextResponse.json(
      {
        error:
          "Unauthorized. Use Authorization: Bearer <supabase_access_token> or set DEV_USER_ID in .env.local for local testing.",
      },
      { status: 401 },
    );
  }

  const statePayload = createOAuthStatePayload(providerValue, userId);
  const authorizeUrl = buildAuthorizationUrl(providerValue, statePayload.state);
  const response = NextResponse.redirect(authorizeUrl);

  response.cookies.set(OAUTH_STATE_COOKIE, encodeStatePayload(statePayload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });

  return response;
}
