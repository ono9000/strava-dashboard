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
): Promise<NextResponse> {
  const { provider: providerValue } = await params;

  if (!isIntegrationProvider(providerValue)) {
    return NextResponse.json({ error: "Unsupported provider." }, { status: 400 });
  }

  // Try cookie auth first (browser/UI flow), then Bearer (API flow)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? await resolveUserIdFromRequest(request);

  if (!userId) {
    return new Response("Unauthorized", { status: 401 }) as unknown as NextResponse;
  }

  // Read and validate returnTo param
  const rawReturnTo = new URL(request.url).searchParams.get('returnTo');
  const returnTo = (rawReturnTo === 'onboarding' || rawReturnTo === 'settings')
    ? rawReturnTo
    : undefined;

  const statePayload = createOAuthStatePayload(providerValue, userId, returnTo);
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
