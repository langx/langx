import { Tabs } from 'expo-router'
import { Text } from 'react-native'
import { colors } from '../../src/lib/theme'
import { usePushRegistration } from '../../src/hooks/usePushRegistration'
import { useSocket } from '../../src/hooks/useSocket'

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.45 }}>{emoji}</Text>
}

/**
 * The socket and the push registration are started here, once, for the whole
 * signed-in area — not per screen. A socket opened in the chat screen would
 * miss the message that arrives while the user is on the discovery tab, which
 * is exactly when the unread badge needs to update.
 */
export default function AppLayout() {
  useSocket()
  usePushRegistration()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🧭" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chats',
          tabBarIcon: ({ focused }) => <TabIcon emoji="💬" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Leaderboard',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏆" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
        }}
      />
      {/* Reachable by navigation, never a tab. */}
      <Tabs.Screen name="chat/[id]" options={{ href: null }} />
      <Tabs.Screen name="profile/[handle]" options={{ href: null }} />
      <Tabs.Screen name="edit-profile" options={{ href: null }} />
      <Tabs.Screen name="blocked" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="paywall" options={{ href: null }} />
      <Tabs.Screen name="viewers" options={{ href: null }} />
      <Tabs.Screen name="filters" options={{ href: null }} />
    </Tabs>
  )
}
