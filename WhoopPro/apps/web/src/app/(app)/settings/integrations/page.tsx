import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listIntegrationStatus } from '@/lib/integrations/repository'
import { IntegrationsManager } from '@/components/settings/IntegrationsManager'

const SUPPORTED_PROVIDERS = ['whoop', 'google'] as const
type SupportedProvider = typeof SUPPORTED_PROVIDERS[number]

export default async function SettingsIntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const statusRows = await listIntegrationStatus(user.id)

  // Synthesise full list — missing providers get connected = false
  const integrations = SUPPORTED_PROVIDERS.map((provider) => {
    const row = statusRows.find((r) => r.provider === provider)
    return {
      provider,
      connected: !!row,
      lastSyncAt: row?.lastSyncAt ?? null,
    }
  })

  const { connected = null, error = null } = await searchParams

  return (
    <IntegrationsManager
      integrations={integrations}
      connectedParam={connected}
      errorParam={error}
    />
  )
}
