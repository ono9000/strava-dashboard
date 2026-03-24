'use server'

import { createClient } from '@/lib/supabase/server'

export async function saveProfileAction(data: {
  timezone: string
  chronotype: 'morning' | 'balanced' | 'evening'
  objective: 'performance' | 'balance' | 'recovery' | 'consistency'
}): Promise<{ ok: true } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Not authenticated.' }
    }

    const { error } = await supabase
      .from('profiles')
      .upsert(
        {
          user_id: user.id,
          timezone: data.timezone,
          chronotype: data.chronotype,
          objective: data.objective,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )

    if (error) {
      return { error: error.message }
    }

    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error saving profile.'
    return { error: message }
  }
}
