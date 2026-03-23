import { requireEnv } from "@/lib/env";

export type IntegrationProvider = "whoop" | "google" | "oura";
export type IntegrationProviderDb = "whoop" | "google_calendar" | "oura";

interface ProviderConfig {
  authUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  authParams?: Record<string, string>;
}

export interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  [key: string]: unknown;
}

const PROVIDERS: Record<IntegrationProvider, Omit<ProviderConfig, "clientId" | "clientSecret" | "redirectUri">> = {
  whoop: {
    authUrl: "https://api.prod.whoop.com/oauth/oauth2/auth",
    tokenUrl: "https://api.prod.whoop.com/oauth/oauth2/token",
    scopes: ["offline", "read:profile", "read:recovery", "read:sleep", "read:cycles", "read:workout"],
  },
  google: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
    authParams: {
      access_type: "offline",
      include_granted_scopes: "true",
      prompt: "consent",
    },
  },
  oura: {
    authUrl: "https://cloud.ouraring.com/oauth/authorize",
    tokenUrl: "https://api.ouraring.com/oauth/token",
    scopes: ["daily", "heartrate", "session", "sleep", "readiness", "workout", "personal"],
  },
};

function resolveProviderConfig(provider: IntegrationProvider): ProviderConfig {
  switch (provider) {
    case "whoop":
      return {
        ...PROVIDERS.whoop,
        clientId: requireEnv("WHOOP_CLIENT_ID"),
        clientSecret: requireEnv("WHOOP_CLIENT_SECRET"),
        redirectUri: requireEnv("WHOOP_REDIRECT_URI"),
      };
    case "google":
      return {
        ...PROVIDERS.google,
        clientId: requireEnv("GOOGLE_CLIENT_ID"),
        clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
        redirectUri: requireEnv("GOOGLE_REDIRECT_URI"),
      };
    case "oura":
      return {
        ...PROVIDERS.oura,
        clientId: requireEnv("OURA_CLIENT_ID"),
        clientSecret: requireEnv("OURA_CLIENT_SECRET"),
        redirectUri: requireEnv("OURA_REDIRECT_URI"),
      };
    default:
      throw new Error(`Unsupported provider: ${provider as string}`);
  }
}

export function isIntegrationProvider(value: string): value is IntegrationProvider {
  return value === "whoop" || value === "google" || value === "oura";
}

export function mapProviderToDb(provider: IntegrationProvider): "whoop" | "google_calendar" | "oura" {
  if (provider === "google") return "google_calendar";
  return provider;
}

export function mapDbToProvider(provider: IntegrationProviderDb): IntegrationProvider {
  if (provider === "google_calendar") return "google";
  return provider;
}

export function buildAuthorizationUrl(provider: IntegrationProvider, state: string): URL {
  const config = resolveProviderConfig(provider);
  const url = new URL(config.authUrl);

  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", config.scopes.join(" "));
  url.searchParams.set("state", state);

  if (config.authParams) {
    Object.entries(config.authParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  return url;
}

export async function exchangeAuthorizationCode(
  provider: IntegrationProvider,
  code: string,
): Promise<OAuthTokenResponse> {
  const config = resolveProviderConfig(provider);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Token exchange failed for ${provider}: ${details}`);
  }

  return (await response.json()) as OAuthTokenResponse;
}

export async function refreshAccessToken(
  provider: IntegrationProvider,
  refreshToken: string,
): Promise<OAuthTokenResponse> {
  const config = resolveProviderConfig(provider);
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Token refresh failed for ${provider}: ${details}`);
  }

  return (await response.json()) as OAuthTokenResponse;
}
