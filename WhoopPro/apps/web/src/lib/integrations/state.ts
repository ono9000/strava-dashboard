import { randomUUID } from "node:crypto";
import type { IntegrationProvider } from "@/lib/integrations/oauth";

export const OAUTH_STATE_COOKIE = "axial_oauth_state";

export interface OAuthStatePayload {
  state: string;
  provider: IntegrationProvider;
  userId: string;
  issuedAt: number;
}

export function createOAuthStatePayload(
  provider: IntegrationProvider,
  userId: string,
): OAuthStatePayload {
  return {
    state: randomUUID(),
    provider,
    userId,
    issuedAt: Date.now(),
  };
}

export function encodeStatePayload(payload: OAuthStatePayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeStatePayload(value?: string): OAuthStatePayload | null {
  if (!value) return null;

  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as Partial<OAuthStatePayload>;

    if (
      typeof parsed.state === "string" &&
      typeof parsed.userId === "string" &&
      (parsed.provider === "whoop" ||
        parsed.provider === "google" ||
        parsed.provider === "oura") &&
      typeof parsed.issuedAt === "number"
    ) {
      return parsed as OAuthStatePayload;
    }
  } catch {
    return null;
  }

  return null;
}
