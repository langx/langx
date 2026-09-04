import Feather from '@expo/vector-icons/Feather'
import { Tabs } from 'expo-router'
import { useEffect } from 'react'
import type { ColorValue } from 'react-native'
import { useUnreadTotal } from '../../../src/api/queries'
import { useTheme } from '../../../src/lib/theme'
import { useT } from '../../../src/i18n'
import { authClient } from '../../../src/lib/auth-client'
import { shouldGateGuest } from '../../../src/lib/guestGate'
import { syncIconBadge } from '../../../src/lib/iconBadge'
import { unreadBadge } from '../../../src/lib/unreadBadge'

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
 * The four tabs, and only the four tabs.
 *
 * Every other signed-in screen used to be registered here too, as a
 * `Tabs.Screen` with `href: null` and a hidden bar — which made them tabs
 * rather than stack entries. A tab navigator has no stack: pushing one
 * *switched* to it, nothing was pushed, so there was nothing for iOS's swipe
 * gesture to pop and every back control was a `router.replace`. They are stack
 * screens now, in the layout above this one; this navigator is the stack's
 * first entry.
 */
export default function TabsLayout() {
  const { colors } = useTheme()
  const t = useT()
  const { data: session } = authClient.useSession()
  // A guest has no conversations, so asking for a total would be a request
  // that can only ever answer zero.
  const unread = useUnreadTotal(!shouldGateGuest(session?.user))
  // Spread rather than passed as `undefined`: the option is typed as present
  // or absent, and an explicit `undefined` is neither.
  const badge = unreadBadge(unread.data)
  /*
   * The icon follows the same number as the tab, from the same query — see
   * `syncIconBadge`. Whatever changes the total invalidates that query, so
   * this runs on read, on a new message and on archive alike.
   *
   * Keyed on `dataUpdatedAt` as well as the number, because the icon has a
   * second writer: a push notification carries its own `badge` and sets it
   * without asking this app. When the phone comes back and the refetch
   * returns the same total it already held, the value is unchanged, this
   * effect would not run, and the number the push left behind would stand —
   * which is how the icon, the tab and the row ended up disagreeing. The
   * timestamp moves on every fetch, so a confirmed total always overwrites.
   */
  useEffect(() => {
    if (unread.data !== undefined) void syncIconBadge(unread.data)
  }, [unread.data, unread.dataUpdatedAt])

  return (
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
          /*
           * A message that arrives while somebody is on another tab was
           * invisible until they went looking for it. The count comes from
           * the server rather than from the loaded chat list, which is paged
           * and would only ever total what had been scrolled to.
           */
          ...(badge
            ? {
                tabBarBadge: badge,
                tabBarBadgeStyle: {
                  backgroundColor: colors.danger,
                  color: colors.textInverse,
                },
              }
            : {}),
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
    </Tabs>
  )
}
