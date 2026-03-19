import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

export default function AppLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#111827', tabBarInactiveTintColor: '#9ca3af', headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size }) => <Ionicons name="shirt-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  )
}
