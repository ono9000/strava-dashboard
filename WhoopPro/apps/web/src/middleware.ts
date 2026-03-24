import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const path = request.nextUrl.pathname;

  const isAppRoute = path.startsWith("/dashboard") || path.startsWith("/settings");
  const isOnboarding = path === "/onboarding";
  const isAuthRoute = path === "/login" || path === "/signup";

  if ((isAppRoute || isOnboarding) && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    const redirectResponse = NextResponse.redirect(loginUrl);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  }

  if (isAuthRoute && user) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    const redirectResponse = NextResponse.redirect(dashboardUrl);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup", "/onboarding", "/settings/:path*"],
};
