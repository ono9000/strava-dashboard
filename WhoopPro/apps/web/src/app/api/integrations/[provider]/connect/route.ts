import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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
): Promise<NextResponse | Response> {
  const { provider: providerValue } = await params;

  if (!isIntegrationProvider(providerValue)) {
    return NextResponse.json({ error: "Unsupported provider." }, { status: 400 });
  }

  // Try cookie auth first (browser/UI flow), then Bearer (API flow)
  const supabase = await createClient();
  const { data: { user }, error: sessionError } = await supabase.auth.getUser();

  let userId: string | undefined;
  if (sessionError) {
    return new Response("Unauthorized", { status: 401 });
  } else if (user) {
    userId = user.id;
  } else {
    // No session at all — try Bearer (API flow)
    userId = await resolveUserIdFromRequest(request) ?? undefined;
  }

  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Read and validate returnTo param
  const rawReturnTo = request.nextUrl.searchParams.get('returnTo');
  const returnTo = (rawReturnTo === 'onboarding' || rawReturnTo === 'settings')
    ? rawReturnTo
    : undefined;

  const statePayload = createOAuthStatePayload(providerValue, userId, returnTo);

  let authorizeUrl: URL;
  try {
    authorizeUrl = buildAuthorizationUrl(providerValue, statePayload.state);
  } catch {
    return new Response("Integration not configured.", { status: 500 });
  }

  const response = NextResponse.redirect(authorizeUrl.toString());

  response.cookies.set(OAUTH_STATE_COOKIE, encodeStatePayload(statePayload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });

  return response;
}
