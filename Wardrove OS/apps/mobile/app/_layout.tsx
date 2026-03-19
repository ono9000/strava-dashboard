import { useEffect, useState } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

function useAuthRedirect(session: Session | null | undefined, onboardingComplete: boolean | null) {
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    if (session === undefined || onboardingComplete === null) return

    const inAuthGroup = segments[0] === '(auth)'

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login')
    } else if (session && !onboardingComplete && segments[1] !== 'onboarding') {
      router.replace('/(app)/onboarding')
    } else if (session && onboardingComplete && inAuthGroup) {
      router.replace('/(app)')
    }
  }, [session, onboardingComplete, segments])
}

export default function RootLayout() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null)
      if (session) fetchOnboarding(session.user.id)
      else setOnboardingComplete(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null)
      if (session) fetchOnboarding(session.user.id)
      else setOnboardingComplete(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchOnboarding(userId: string) {
    const { data } = await supabase
      .from('users')
      .select('onboarding_complete')
      .eq('id', userId)
      .single()
    setOnboardingComplete(data?.onboarding_complete ?? false)
  }

  useAuthRedirect(session, onboardingComplete)

  if (session === undefined) return null

  return (
    <>
      <StatusBar style="auto" />
      <Slot />
    </>
  )
}
