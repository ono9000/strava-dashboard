import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native'
import { Link } from 'expo-router'
import { supabase } from '@/lib/supabase'

export default function SignupScreen() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSignup() {
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      })
      if (error) setError(error.message)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View className="flex-1 justify-center px-6">
        <Text className="text-3xl font-bold text-gray-900">Create your wardrobe</Text>
        <Text className="mt-1 text-sm text-gray-500">Free to start, intelligent by design</Text>
        <View className="mt-8 gap-4">
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1">Name</Text>
            <TextInput value={name} onChangeText={setName} placeholder="Your name"
              className="border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900" />
          </View>
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1">Email</Text>
            <TextInput value={email} onChangeText={setEmail} autoCapitalize="none"
              keyboardType="email-address" placeholder="you@example.com"
              className="border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900" />
          </View>
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1">Password</Text>
            <TextInput value={password} onChangeText={setPassword} secureTextEntry
              placeholder="Min. 8 characters"
              className="border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900" />
          </View>
          {error && <Text className="text-sm text-red-600">{error}</Text>}
          <TouchableOpacity onPress={handleSignup} disabled={loading}
            className="bg-gray-900 rounded-xl py-3.5 items-center mt-2">
            <Text className="text-white font-semibold text-sm">
              {loading ? 'Creating account…' : 'Create account'}
            </Text>
          </TouchableOpacity>
        </View>
        <Text className="text-center text-sm text-gray-500 mt-6">
          Have an account?{' '}
          <Link href="/(auth)/login" className="font-medium text-gray-900">Sign in</Link>
        </Text>
      </View>
    </KeyboardAvoidingView>
  )
}
