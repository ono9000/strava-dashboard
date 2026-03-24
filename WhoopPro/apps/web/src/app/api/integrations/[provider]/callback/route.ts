import { NextRequest, NextResponse } from "next/server";
import { exchangeAuthorizationCode, isIntegrationProvider } from "@/lib/integrations/oauth";
import { saveIntegrationToken } from "@/lib/integrations/repository";
import { decodeStatePayload, OAUTH_STATE_COOKIE } from "@/lib/integrations/state";
import { resolveCallbackDestination } from "@/lib/integrations/redirect";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getBaseUrl(request: NextRequest): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
}

function clearStateCookieOn(response: NextResponse): void {
  response.cookies.set(OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  const { provider: providerValue } = await params;

  if (!isIntegrationProvider(providerValue)) {
    // Unknown provider — redirect to settings with error (no JSON)
    return NextResponse.redirect(new URL('/settings/integrations?error=connect_failed', getBaseUrl(request)));
  }

  // Decode state cookie first — needed for returnTo in all error paths
  const stateCookie = decodeStatePayload(request.cookies.get(OAUTH_STATE_COOKIE)?.value);
  const returnTo = stateCookie?.returnTo;

  // Provider returned an OAuth error
  const oauthError = request.nextUrl.searchParams.get("error");
  if (oauthError) {
    const destination = resolveCallbackDestination('error', returnTo, providerValue);
    const response = NextResponse.redirect(new URL(destination, getBaseUrl(request)));
    clearStateCookieOn(response);
    return response;
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  // Missing state cookie, code, or state param
  if (!code || !state || !stateCookie) {
    const destination = resolveCallbackDestination('error', returnTo, providerValue);
    const response = NextResponse.redirect(new URL(destination, getBaseUrl(request)));
    clearStateCookieOn(response);
    return response;
  }

  // CSRF / expiry check
  const isValidState =
    stateCookie.provider === providerValue &&
    stateCookie.state === state &&
    Date.now() - stateCookie.issuedAt <= 10 * 60 * 1000;

  if (!isValidState) {
    const destination = resolveCallbackDestination('error', returnTo, providerValue);
    const response = NextResponse.redirect(new URL(destination, getBaseUrl(request)));
    clearStateCookieOn(response);
    return response;
  }

  if (!stateCookie.userId) {
    const destination = resolveCallbackDestination('error', returnTo, providerValue);
    const response = NextResponse.redirect(new URL(destination, getBaseUrl(request)));
    clearStateCookieOn(response);
    return response;
  }

  try {
    const token = await exchangeAuthorizationCode(providerValue, code);
    await saveIntegrationToken({
      userId: stateCookie.userId,
      provider: providerValue,
      token,
    });

    const destination = resolveCallbackDestination('success', returnTo, providerValue);
    const response = NextResponse.redirect(new URL(destination, getBaseUrl(request)));
    clearStateCookieOn(response);
    return response;
  } catch {
    const destination = resolveCallbackDestination('error', returnTo, providerValue);
    const response = NextResponse.redirect(new URL(destination, getBaseUrl(request)));
    clearStateCookieOn(response);
    return response;
  }
}
