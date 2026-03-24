'use client'

type Provider = 'whoop' | 'google'

interface IntegrationStatus {
  provider: Provider
  connected: boolean
  lastSyncAt: string | null
}

interface IntegrationsManagerProps {
  integrations: IntegrationStatus[]
  connectedParam: string | null
  errorParam: string | null
}

const PROVIDER_LABELS: Record<Provider, string> = {
  whoop: 'WHOOP',
  google: 'Google Calendar',
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function IntegrationsManager({
  integrations,
  connectedParam,
  errorParam,
}: IntegrationsManagerProps) {
  const connectedProviderLabel =
    connectedParam && connectedParam in PROVIDER_LABELS
      ? PROVIDER_LABELS[connectedParam as Provider]
      : null

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-1">Integrations</h1>
      <p className="text-sm text-[color-mix(in_srgb,var(--foreground)_60%,white)] mb-6">
        Connect your data sources to power your daily briefing.
      </p>

      {connectedProviderLabel && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-800 rounded-lg px-3 py-2 text-sm">
          {connectedProviderLabel} connected successfully.
        </div>
      )}

      {errorParam === 'connect_failed' && (
        <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 text-sm">
          Could not connect integration. Please try again.
        </div>
      )}

      <div className="flex flex-col gap-3">
        {integrations.map(({ provider, connected, lastSyncAt }) => (
          <div
            key={provider}
            className="border border-[var(--line)] rounded-lg px-4 py-4 flex items-center justify-between"
          >
            <div>
              <p className="font-medium text-[var(--foreground)]">{PROVIDER_LABELS[provider]}</p>
              {connected ? (
                <p className="text-xs text-[color-mix(in_srgb,var(--foreground)_50%,white)]">
                  Last synced: {formatDate(lastSyncAt)}
                </p>
              ) : (
                <p className="text-xs text-[color-mix(in_srgb,var(--foreground)_50%,white)]">
                  Not connected
                </p>
              )}
            </div>
            {connected ? (
              <a
                href={`/api/integrations/${provider}/connect?returnTo=settings`}
                className="text-xs font-medium text-[color-mix(in_srgb,var(--foreground)_50%,white)] hover:text-[var(--foreground)] transition-colors"
              >
                Reconnect
              </a>
            ) : (
              <a
                href={`/api/integrations/${provider}/connect?returnTo=settings`}
                className="text-xs font-medium text-[var(--accent)] hover:underline"
              >
                Connect
              </a>
            )}
          </div>
        ))}

        {/* Oura — coming soon */}
        <div className="border border-[var(--line)] rounded-lg px-4 py-4 flex items-center justify-between opacity-50">
          <div>
            <p className="font-medium text-[var(--foreground)]">Oura</p>
            <p className="text-xs text-[color-mix(in_srgb,var(--foreground)_50%,white)]">Coming soon</p>
          </div>
          <span className="text-xs text-[color-mix(in_srgb,var(--foreground)_40%,white)]">—</span>
        </div>
      </div>
    </div>
  )
}
