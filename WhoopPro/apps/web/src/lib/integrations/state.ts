import { randomUUID } from "node:crypto";
import type { IntegrationProvider } from "@/lib/integrations/oauth";

export const OAUTH_STATE_COOKIE = "axial_oauth_state";

export interface OAuthStatePayload {
  state: string;
  provider: IntegrationProvider;
  userId: string;
  issuedAt: number;
  returnTo?: 'onboarding' | 'settings';
}

export function createOAuthStatePayload(
  provider: IntegrationProvider,
  userId: string,
  returnTo?: 'onboarding' | 'settings',
): OAuthStatePayload {
  const payload: OAuthStatePayload = {
    state: randomUUID(),
    provider,
    userId,
    issuedAt: Date.now(),
  };
  if (returnTo !== undefined) {
    payload.returnTo = returnTo;
  }
  return payload;
}

export function encodeStatePayload(payload: OAuthStatePayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeStatePayload(value?: string): OAuthStatePayload | null {
  if (!value) return null;

  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as Record<string, unknown>;

    if (
      typeof parsed.state === "string" &&
      typeof parsed.userId === "string" &&
      (parsed.provider === "whoop" ||
        parsed.provider === "google" ||
        parsed.provider === "oura") &&
      typeof parsed.issuedAt === "number"
    ) {
      const result: OAuthStatePayload = {
        state: parsed.state,
        provider: parsed.provider,
        userId: parsed.userId,
        issuedAt: parsed.issuedAt,
      };
      // Whitelist returnTo — only carry through known values
      if (parsed.returnTo === 'onboarding' || parsed.returnTo === 'settings') {
        result.returnTo = parsed.returnTo;
      }
      return result;
    }
  } catch {
    return null;
  }

  return null;
}
