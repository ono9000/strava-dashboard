import { decryptSecret, encryptSecret } from "@/lib/crypto";
import {
  mapDbToProvider,
  mapProviderToDb,
  type IntegrationProvider,
  type IntegrationProviderDb,
  type OAuthTokenResponse,
} from "@/lib/integrations/oauth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function saveIntegrationToken(params: {
  userId: string;
  provider: IntegrationProvider;
  token: OAuthTokenResponse;
}): Promise<void> {
  const { userId, provider, token } = params;
  const supabase = getSupabaseAdminClient();

  const accessTokenEncrypted = encryptSecret(token.access_token);
  const refreshTokenEncrypted = token.refresh_token ? encryptSecret(token.refresh_token) : null;
  const expiresAt =
    typeof token.expires_in === "number" ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null;
  const scopes =
    typeof token.scope === "string"
      ? token.scope
          .split(" ")
          .map((entry) => entry.trim())
          .filter(Boolean)
      : [];

  const { error } = await supabase.from("integrations").upsert(
    {
      user_id: userId,
      provider: mapProviderToDb(provider),
      access_token_enc: accessTokenEncrypted,
      refresh_token_enc: refreshTokenEncrypted,
      expires_at: expiresAt,
      scopes,
      last_sync_at: null,
    },
    { onConflict: "user_id,provider" },
  );

  if (error) {
    throw new Error(`Failed to store ${provider} token: ${error.message}`);
  }
}

export interface IntegrationCredentials {
  provider: IntegrationProvider;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  scopes: string[];
}

interface IntegrationRow {
  provider: IntegrationProviderDb;
  access_token_enc: string;
  refresh_token_enc: string | null;
  expires_at: string | null;
  scopes: string[] | null;
}

interface IntegrationStatusRow {
  provider: IntegrationProviderDb;
  expires_at: string | null;
  last_sync_at: string | null;
  scopes: string[] | null;
}

function mapRowToCredentials(row: IntegrationRow): IntegrationCredentials {
  return {
    provider: mapDbToProvider(row.provider),
    accessToken: decryptSecret(row.access_token_enc),
    refreshToken: row.refresh_token_enc ? decryptSecret(row.refresh_token_enc) : undefined,
    expiresAt: row.expires_at ?? undefined,
    scopes: row.scopes ?? [],
  };
}

export async function getIntegrationCredentials(
  userId: string,
  provider: IntegrationProvider,
): Promise<IntegrationCredentials | null> {
  const supabase = getSupabaseAdminClient();
  const providerDb = mapProviderToDb(provider);

  const { data, error } = await supabase
    .from("integrations")
    .select("provider, access_token_enc, refresh_token_enc, expires_at, scopes")
    .eq("user_id", userId)
    .eq("provider", providerDb)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load credentials for ${provider}: ${error.message}`);
  }

  if (!data) return null;
  return mapRowToCredentials(data as IntegrationRow);
}

export async function updateIntegrationTokenAfterRefresh(params: {
  userId: string;
  provider: IntegrationProvider;
  token: OAuthTokenResponse;
}): Promise<void> {
  const { userId, provider, token } = params;
  const supabase = getSupabaseAdminClient();

  const updates: Record<string, unknown> = {
    access_token_enc: encryptSecret(token.access_token),
  };

  if (token.refresh_token) {
    updates.refresh_token_enc = encryptSecret(token.refresh_token);
  }

  if (typeof token.expires_in === "number") {
    updates.expires_at = new Date(Date.now() + token.expires_in * 1000).toISOString();
  }

  if (typeof token.scope === "string") {
    updates.scopes = token.scope
      .split(" ")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  const { error } = await supabase
    .from("integrations")
    .update(updates)
    .eq("user_id", userId)
    .eq("provider", mapProviderToDb(provider));

  if (error) {
    throw new Error(`Failed to update refreshed token for ${provider}: ${error.message}`);
  }
}

export async function touchIntegrationSync(userId: string, provider: IntegrationProvider): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("integrations")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("provider", mapProviderToDb(provider));

  if (error) {
    throw new Error(`Failed to update sync timestamp for ${provider}: ${error.message}`);
  }
}

export async function listIntegrationStatus(userId: string): Promise<
  Array<{
    provider: IntegrationProvider;
    expiresAt: string | null;
    lastSyncAt: string | null;
    scopes: string[];
  }>
> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("integrations")
    .select("provider, expires_at, last_sync_at, scopes")
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to list integrations: ${error.message}`);
  }

  return ((data ?? []) as IntegrationStatusRow[]).map((row) => ({
    provider: mapDbToProvider(row.provider),
    expiresAt: row.expires_at,
    lastSyncAt: row.last_sync_at,
    scopes: row.scopes ?? [],
  }));
}
