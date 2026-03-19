import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Location from 'expo-location'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { apiPost } from '@/lib/api'

export default function OnboardingScreen() {
  const router = useRouter()
  const [step, setStep] = useState<'location' | 'done'>('location')
  const [city, setCity] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [loading, setLoading] = useState(false)

  async function requestLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') { Alert.alert('Denied', 'Please enter your city manually.'); return }
    const loc = await Location.getCurrentPositionAsync({})
    setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude })
  }

  async function handleFinish() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/(auth)/login'); return }

      const update: Record<string, unknown> = { onboarding_complete: true }

      if (coords) {
        update.location_lat = coords.lat
        update.location_lng = coords.lng
      } else if (city.trim()) {
        try {
          const { lat, lng } = await apiPost<{ lat: number; lng: number }>('/api/location/geocode', { city: city.trim() })
          update.location_lat = lat
          update.location_lng = lng
        } catch { /* proceed without coords */ }
      }

      const { error } = await supabase.from('users').update(update).eq('id', user.id)
      if (error) { Alert.alert('Error', error.message); return }
      router.replace('/(app)')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 justify-center">
        <Text className="text-xs font-medium text-gray-400 uppercase tracking-wider">Step {step === 'location' ? '1' : '2'} of 2</Text>
        <Text className="mt-1 text-3xl font-bold text-gray-900">{step === 'location' ? 'Where are you?' : 'Almost done'}</Text>
        <Text className="mt-2 text-sm text-gray-500">{step === 'location' ? 'We use your location for weather-based outfit suggestions.' : 'Your wardrobe is ready to explore.'}</Text>

        {step === 'location' && (
          <View className="mt-8 gap-4">
            {coords ? (
              <Text className="text-sm text-green-600 font-medium">✓ Location captured</Text>
            ) : (
              <>
                <TouchableOpacity onPress={requestLocation} className="border border-gray-300 rounded-xl py-3.5 items-center">
                  <Text className="text-sm font-medium text-gray-700">Use current location</Text>
                </TouchableOpacity>
                <Text className="text-center text-xs text-gray-400">or</Text>
                <TextInput value={city} onChangeText={setCity} placeholder="Enter your city (e.g. Madrid)" className="border border-gray-300 rounded-xl px-4 py-3 text-sm" />
              </>
            )}
            <TouchableOpacity onPress={() => setStep('done')} className="bg-gray-900 rounded-xl py-3.5 items-center mt-2">
              <Text className="text-white font-semibold text-sm">Next</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'done' && (
          <View className="mt-8">
            <TouchableOpacity onPress={handleFinish} disabled={loading} className="bg-gray-900 rounded-xl py-3.5 items-center">
              <Text className="text-white font-semibold text-sm">{loading ? 'Setting up…' : 'Enter my wardrobe'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  )
}
