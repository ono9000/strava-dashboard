import { NextRequest, NextResponse } from "next/server";
import { exchangeAuthorizationCode, isIntegrationProvider } from "@/lib/integrations/oauth";
import { saveIntegrationToken } from "@/lib/integrations/repository";
import { decodeStatePayload, OAUTH_STATE_COOKIE } from "@/lib/integrations/state";

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

  const oauthError = request.nextUrl.searchParams.get("error");
  if (oauthError) {
    return NextResponse.json({ error: `OAuth provider error: ${oauthError}` }, { status: 400 });
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const stateCookie = decodeStatePayload(request.cookies.get(OAUTH_STATE_COOKIE)?.value);

  if (!code || !state || !stateCookie) {
    return NextResponse.json({ error: "Missing OAuth state or authorization code." }, { status: 400 });
  }

  const isValidState =
    stateCookie.provider === providerValue &&
    stateCookie.state === state &&
    Date.now() - stateCookie.issuedAt <= 10 * 60 * 1000;

  if (!isValidState) {
    return NextResponse.json({ error: "Invalid or expired OAuth state." }, { status: 400 });
  }

  try {
    const token = await exchangeAuthorizationCode(providerValue, code);
    await saveIntegrationToken({
      userId: stateCookie.userId,
      provider: providerValue,
      token,
    });

    const response = NextResponse.json({
      ok: true,
      provider: providerValue,
      userId: stateCookie.userId,
      message: "Integration connected and token stored.",
    });

    response.cookies.set(OAUTH_STATE_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown OAuth callback failure.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
