'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<'location' | 'done'>('location')
  const [city, setCity] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function requestGeolocation() {
    if (!navigator.geolocation) {
      setGeoError('Geolocation not supported. Please enter your city.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGeoError(null) },
      () => setGeoError('Location access denied. Please enter your city.')
    )
  }

  function handleLocationNext(e: React.FormEvent) {
    e.preventDefault()
    if (!coords && !city.trim()) { setGeoError('Provide your location or city.'); return }
    setStep('done')
  }

  async function handleFinish(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const supabase = getSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const update: Record<string, unknown> = { onboarding_complete: true }

      if (coords) {
        update.location_lat = coords.lat
        update.location_lng = coords.lng
      } else if (city.trim()) {
        const res = await fetch('/api/location/geocode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ city: city.trim() }),
        })
        if (res.ok) {
          const { lat, lng } = await res.json() as { lat: number; lng: number }
          update.location_lat = lat
          update.location_lng = lng
        }
        // If geocoding fails, proceed without coords — weather will prompt on first use
      }

      const { error } = await supabase.from('users').update(update).eq('id', user.id)
      if (error) { setError(error.message); return }
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-lg p-8 bg-white rounded-xl shadow-sm border border-gray-200 space-y-6">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            Step {step === 'location' ? '1' : '2'} of 2
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">
            {step === 'location' ? 'Where are you?' : 'Almost done'}
          </h1>
        </div>

        {step === 'location' ? (
          <form onSubmit={handleLocationNext} className="space-y-4">
            <p className="text-sm text-gray-500">We use your location for weather-appropriate outfit suggestions.</p>
            {coords ? (
              <p className="text-sm text-green-600 font-medium">✓ Location captured</p>
            ) : (
              <>
                <button type="button" onClick={requestGeolocation}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                  Use my current location
                </button>
                <div className="flex items-center gap-3">
                  <div className="flex-1 border-t border-gray-200" />
                  <span className="text-xs text-gray-400">or</span>
                  <div className="flex-1 border-t border-gray-200" />
                </div>
                <input type="text" value={city} onChange={e => setCity(e.target.value)}
                  placeholder="Enter your city (e.g. Madrid)"
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </>
            )}
            {geoError && <p className="text-sm text-red-600">{geoError}</p>}
            <button type="submit"
              className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 transition-colors">
              Next
            </button>
          </form>
        ) : (
          <form onSubmit={handleFinish} className="space-y-4">
            <p className="text-sm text-gray-500">Your wardrobe is ready. You can update preferences anytime.</p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50 transition-colors">
              {loading ? 'Setting up…' : 'Enter my wardrobe'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
