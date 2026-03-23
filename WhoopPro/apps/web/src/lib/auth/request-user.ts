import { NextRequest } from "next/server";
import { optionalEnv } from "@/lib/env";
import { getSupabasePublicClient } from "@/lib/supabase/public";

function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export async function resolveUserIdFromRequest(request: NextRequest): Promise<string | null> {
  const token = extractBearerToken(request);

  if (!token) {
    const devUserId = optionalEnv("DEV_USER_ID") ?? null;
    if (devUserId && process.env.NODE_ENV !== "development") {
      throw new Error("DEV_USER_ID must not be set outside local development");
    }
    return devUserId;
  }

  const supabase = getSupabasePublicClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return null;
  }

  return data.user.id;
}
