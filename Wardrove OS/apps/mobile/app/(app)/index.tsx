import { useEffect, useState } from 'react'
import { View, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'

export default function DashboardScreen() {
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('users').select('name').eq('id', user.id).single()
        .then(({ data }) => setName(data?.name ?? null))
    })
  }, [])

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 py-8">
        <Text className="text-2xl font-bold text-gray-900">Good morning{name ? `, ${name}` : ''}.</Text>
        <Text className="mt-1 text-sm text-gray-500">Your wardrobe is ready. Start by adding your first item.</Text>
        <View className="flex-1 items-center justify-center">
          <Text className="text-sm text-gray-400 text-center">Clothing inventory coming in Plan 2.</Text>
        </View>
      </View>
    </SafeAreaView>
  )
}
