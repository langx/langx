import { Tabs } from 'expo-router'
import { Text } from 'react-native'
import { DeletionBanner } from '../../src/components/DeletionBanner'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../../src/lib/theme'
import { useNotificationRouting } from '../../src/hooks/useNotificationRouting'
import { usePushRegistration } from '../../src/hooks/usePushRegistration'
import { useSocket } from '../../src/hooks/useSocket'

/** Not a tab, and no tab bar under it either. */
const FULL_SCREEN = { href: null, tabBarStyle: { display: 'none' } } as const

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
  // Here rather than in the root layout: every destination a notification has
  // is behind the sign-in gate, so routing from one before there is a session
  // would land on a screen that immediately redirects away.
  useNotificationRouting()

  return (
    /**
     * The banner lives above the navigator so a pending deletion is visible on
     * every screen rather than only where someone happens to look. `edges` is
     * top-only: the tab bar owns the bottom inset.
     */
    <SafeAreaView style={{ backgroundColor: colors.bg, flex: 1 }} edges={['top']}>
      <DeletionBanner />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.text,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: { borderTopColor: colors.border },
        }}
      >
        <Tabs.Screen
          name="chats"
          options={{
            title: 'Chats',
            tabBarIcon: ({ focused }) => <TabIcon emoji="💬" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="discover"
          options={{
            title: 'Discover',
            tabBarIcon: ({ focused }) => <TabIcon emoji="🧭" focused={focused} />,
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
        {/*
        Reachable by navigation, never a tab.

        `href: null` only removes the *button*; the screen is still a tab route
        so the bar keeps being drawn under it — a strip of four tabs beneath
        every conversation, settings page and paywall. `FULL_SCREEN` hides the
        bar itself.

        Doing so also corrects a layout bug rather than causing one: `Screen`
        adds `paddingBottom: insets.bottom` unconditionally *and* the navigator
        insets content above the bar, so these screens carried the bottom
        padding twice.
      */}
        <Tabs.Screen name="chat/[id]" options={FULL_SCREEN} />
        <Tabs.Screen name="profile/[handle]" options={FULL_SCREEN} />
        <Tabs.Screen name="edit-profile" options={FULL_SCREEN} />
        <Tabs.Screen name="blocked" options={FULL_SCREEN} />
        <Tabs.Screen name="settings" options={FULL_SCREEN} />
        <Tabs.Screen name="paywall" options={FULL_SCREEN} />
        <Tabs.Screen name="viewers" options={FULL_SCREEN} />
        <Tabs.Screen name="filters" options={FULL_SCREEN} />
        <Tabs.Screen name="intro" options={FULL_SCREEN} />
      </Tabs>
    </SafeAreaView>
  )
}
