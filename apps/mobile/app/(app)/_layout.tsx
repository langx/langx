import Feather from '@expo/vector-icons/Feather'
import { Tabs } from 'expo-router'
import type { ColorValue } from 'react-native'
import { DeletionBanner } from '../../src/components/DeletionBanner'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '../../src/lib/theme'
import { useT } from '../../src/i18n'
import { useNotificationRouting } from '../../src/hooks/useNotificationRouting'
import { usePushRegistration } from '../../src/hooks/usePushRegistration'
import { useSocket } from '../../src/hooks/useSocket'

/** Not a tab, and no tab bar under it either. */
const FULL_SCREEN = { href: null, tabBarStyle: { display: 'none' } } as const

/**
 * Feather rather than Lucide, which is what the design specifies: Lucide is a
 * fork of Feather and draws the same glyphs, but `lucide-react-native` needs
 * `react-native-svg`, and @expo/vector-icons is already a dependency. A whole
 * native module for a set of icons we already have is not a trade worth making.
 */
function TabIcon({ name, color }: { name: keyof typeof Feather.glyphMap; color: ColorValue }) {
  return <Feather name={name} size={22} color={color} />
}

/**
 * The socket and the push registration are started here, once, for the whole
 * signed-in area — not per screen. A socket opened in the chat screen would
 * miss the message that arrives while the user is on the discovery tab, which
 * is exactly when the unread badge needs to update.
 */
export default function AppLayout() {
  const { colors } = useTheme()
  const t = useT()
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
          tabBarActiveTintColor: colors.accent,
          // `textFaint`, not `textMuted`: v3's inactive tab is the tertiary
          // grey, so the active blue is the only thing with weight in the bar.
          tabBarInactiveTintColor: colors.textFaint,
          // v3 brings the words back under the icons — 11px, semibold.
          tabBarShowLabel: true,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        }}
      >
        <Tabs.Screen
          name="discover"
          options={{
            title: t('tabs.discover'),
            tabBarIcon: ({ color }) => <TabIcon name="search" color={color} />,
          }}
        />
        <Tabs.Screen
          name="chats"
          options={{
            title: t('tabs.chats'),
            tabBarIcon: ({ color }) => <TabIcon name="message-square" color={color} />,
          }}
        />
        <Tabs.Screen
          name="feed"
          options={{
            title: t('tabs.feed'),
            tabBarIcon: ({ color }) => <TabIcon name="align-left" color={color} />,
          }}
        />
        <Tabs.Screen
          name="me"
          options={{
            title: t('tabs.me'),
            tabBarIcon: ({ color }) => <TabIcon name="user" color={color} />,
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
        {/*
          Badges left the tab bar to make room for the feed, which is the
          design's call and the right one: the leaderboard is somewhere you go
          occasionally, and the feed is somewhere there is always something to
          do. It is reached from the profile, which is where the badge count
          already lives.
        */}
        <Tabs.Screen name="leaderboard" options={FULL_SCREEN} />
        <Tabs.Screen name="chat/[id]" options={FULL_SCREEN} />
        <Tabs.Screen name="profile/[handle]" options={FULL_SCREEN} />
        <Tabs.Screen name="post/[id]" options={FULL_SCREEN} />
        <Tabs.Screen name="likes" options={FULL_SCREEN} />
        <Tabs.Screen name="follows" options={FULL_SCREEN} />
        <Tabs.Screen name="edit-profile" options={FULL_SCREEN} />
        <Tabs.Screen name="blocked" options={FULL_SCREEN} />
        <Tabs.Screen name="settings" options={FULL_SCREEN} />
        <Tabs.Screen name="starred" options={FULL_SCREEN} />
        <Tabs.Screen name="paywall" options={FULL_SCREEN} />
        <Tabs.Screen name="viewers" options={FULL_SCREEN} />
        <Tabs.Screen name="filters" options={FULL_SCREEN} />
        <Tabs.Screen name="intro" options={FULL_SCREEN} />
        <Tabs.Screen name="wallet" options={FULL_SCREEN} />
        <Tabs.Screen name="tokens" options={FULL_SCREEN} />
        <Tabs.Screen name="kitchen" options={FULL_SCREEN} />
      </Tabs>
    </SafeAreaView>
  )
}
