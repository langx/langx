import Feather from '@expo/vector-icons/Feather'
import { Tabs } from 'expo-router'
import { useEffect } from 'react'
import { View, type ColorValue } from 'react-native'
import { useEchoSummary, useNotificationUnread, useUnreadTotal } from '../../../src/api/queries'
import { TourTarget } from '../../../src/components/TourTarget'
import type { TourTargetId } from '../../../src/lib/tour'
import { makeStyles, useTheme } from '../../../src/lib/theme'
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
function TabIcon({
  name,
  color,
  tour,
}: {
  name: keyof typeof Feather.glyphMap
  color: ColorValue
  /**
   * The id the first-run tour points at, on the three tabs it introduces.
   * Discover has none: it is the tab the tour plays on, so there is nothing to
   * say about the icon for the screen already filling the screen.
   */
  tour?: TourTargetId
}) {
  const icon = <Feather name={name} size={22} color={color} />
  /*
   * Padded, and a rounded square rather than a circle: a hole that hugs a
   * 22-point glyph reads as a speck, not as "this tab", and a circle around a
   * square-ish target reads as a different kind of thing from the hard-edged
   * holes every other step cuts. The padding is on the measurement, not on the
   * view — see `TourTarget` — so the bar itself is untouched.
   */
  return tour ? (
    <TourTarget id={tour} pad={14} radius={14}>
      {icon}
    </TourTarget>
  ) : (
    icon
  )
}

/**
 * The bar's own label style, kept as a constant because a screen that sets
 * `tabBarLabelStyle` of its own replaces this one rather than merging with it
 * — and Echo sets one.
 */
const TAB_LABEL = { fontSize: 11, fontWeight: '600' } as const

/**
 * The raised disc under the Echo tab, and the geometry that keeps the five
 * words on one line.
 *
 * `tabBarIconStyle` overrides the fixed slot the bar lays out for an icon —
 * 31 by 28 — so the disc has to hand back what it borrows: it starts
 * `ECHO_LIFT` above the other glyphs and gives the remainder of the 28 back
 * underneath, which is what `marginBottom` works out to. Get either margin
 * wrong and Echo's label sits off the line the other four share.
 *
 * The lift stops at 20 because the part of the disc that clears the bar's top
 * edge is drawn but not tappable on Android, which delivers no touch outside a
 * view's parent. At 20 the disc's centre and two thirds of its face stay
 * inside the bar; a taller lift would start trading looks for a dead target.
 */
const ECHO_SIZE = 46
const ECHO_LIFT = 20
const ECHO_GLYPH = 24
const ECHO_ICON_STYLE = {
  width: ECHO_SIZE,
  height: ECHO_SIZE,
  marginTop: -ECHO_LIFT,
  marginBottom: 28 + ECHO_LIFT - ECHO_SIZE,
} as const

/**
 * Accent whether the tab is focused or not, which is the whole point: the bar
 * renders every icon twice and cross-fades an active copy against an inactive
 * one, and this one has nothing to fade between. Echo is the habit the app is
 * built around, and a habit that only announces itself once you are already
 * looking at it announces nothing.
 *
 * The tour hole hugs the disc — `pad={6}` and a circle, against the 14-point
 * square the flat glyphs need — because a 46-point disc is already the size of
 * a thing you can point at.
 */
function EchoTabIcon() {
  const styles = useStyles()
  const { colors, radius } = useTheme()
  return (
    <TourTarget id="tabEcho" pad={6} radius={radius.pill}>
      <View style={styles.echoDisc}>
        <Feather name="repeat" size={ECHO_GLYPH} color={colors.textInverse} />
      </View>
    </TourTarget>
  )
}

const useStyles = makeStyles(({ cardShadow, colors, radius }) => ({
  echoDisc: {
    ...cardShadow,
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    height: ECHO_SIZE,
    justifyContent: 'center',
    width: ECHO_SIZE,
  },
}))

/**
 * The five tabs, and only the five tabs.
 *
 * The rule the number is standing in for is the one that matters, and adding
 * Echo does not touch it: nothing that is not a tab may be registered here.
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
   * The bell's number, on the tab as well as in the Feed header.
   *
   * Same guest gate and the same reason: a guest follows nobody and posts
   * nothing, so the request could only ever answer zero — and would 401
   * rather than answer it.
   */
  const feedBadge = unreadBadge(useNotificationUnread(!shouldGateGuest(session?.user)).data)
  /*
   * Cards due. Same guest gate: a guest has no cards, and the request would
   * 401 rather than answer zero.
   */
  const echoBadge = unreadBadge(useEchoSummary(!shouldGateGuest(session?.user)).data?.due)
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
        tabBarLabelStyle: TAB_LABEL,
        /*
         * Forced, rather than left to the bar's own rule, which moves the words
         * beside the icons once the window is 768 points wide — the web build,
         * on a desktop. Echo's disc is laid out as a column: it borrows space
         * above the glyph and returns it below the word, and in a row there is
         * no below.
         */
        tabBarLabelPosition: 'below-icon',
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
          tabBarIcon: ({ color }) => (
            <TabIcon name="message-square" color={color} tour="tabChats" />
          ),
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
                  fontSize: 11,
                  fontWeight: '700',
                },
              }
            : {}),
        }}
      />
      <Tabs.Screen
        name="echo"
        options={{
          title: t('tabs.echo'),
          tabBarIcon: () => <EchoTabIcon />,
          tabBarIconStyle: ECHO_ICON_STYLE,
          // The word under the disc is lit for the same reason the disc is.
          tabBarLabelStyle: { ...TAB_LABEL, color: colors.accent, fontWeight: '700' },
          /*
           * `ink`, where this badge used to be `accent` and the other two are
           * `danger`. Red in this bar means somebody is waiting for you, and a
           * due count is an invitation you made to yourself — that part has
           * not changed. What changed is that accent is now the disc the badge
           * sits on, so the old colour would have gone missing over exactly
           * the half of the badge that overlaps it. Ink reads on both.
           */
          ...(echoBadge
            ? {
                tabBarBadge: echoBadge,
                tabBarBadgeStyle: {
                  backgroundColor: colors.ink,
                  color: colors.bg,
                  fontSize: 11,
                  fontWeight: '700',
                },
              }
            : {}),
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: t('tabs.feed'),
          tabBarIcon: ({ color }) => <TabIcon name="align-left" color={color} tour="tabFeed" />,
          /*
           * The notification centre lives behind the bell in this tab's
           * header, so the tab is where its count has to show — somebody on
           * Chats has no other way of learning there is anything to read.
           * Spread rather than passed as `undefined`, like the badge above.
           */
          ...(feedBadge
            ? {
                tabBarBadge: feedBadge,
                tabBarBadgeStyle: {
                  backgroundColor: colors.danger,
                  color: colors.textInverse,
                  fontSize: 11,
                  fontWeight: '700',
                },
              }
            : {}),
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: t('tabs.me'),
          tabBarIcon: ({ color }) => <TabIcon name="user" color={color} tour="tabMe" />,
        }}
      />
    </Tabs>
  )
}
