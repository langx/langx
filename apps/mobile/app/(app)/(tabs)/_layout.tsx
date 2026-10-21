import Feather from '@expo/vector-icons/Feather'
import { Tabs, useIsFocused } from 'expo-router'
import { useEffect, useRef, type ReactNode } from 'react'
import {
  Animated,
  Platform,
  StyleSheet,
  View,
  type ColorValue,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useEchoSummary, useNotificationUnread, useUnreadTotal } from '../../../src/api/queries'
import { TourTarget } from '../../../src/components/TourTarget'
import type { TourTargetId } from '../../../src/lib/tour'
import { makeStyles, useTheme } from '../../../src/lib/theme'
import { useT } from '../../../src/i18n'
import { authClient } from '../../../src/lib/auth-client'
import { shouldGateGuest } from '../../../src/lib/guestGate'
import { syncIconBadge } from '../../../src/lib/iconBadge'
import { TAB_BADGE_SIZE, badgeGrew, v3TabBadgeStyle } from '../../../src/lib/countBadge'
import { unreadBadge } from '../../../src/lib/unreadBadge'
import { useV3Home } from '../../../src/hooks/useV3Home'
import { useReduceMotion } from '../../../src/hooks/useReduceMotion'
import { PressableScale } from '../../../src/components/ui/PressableScale'
import { EASE_OUT } from '../../../src/lib/theme/motionAnimated'
import { DURATION, PRESS_SCALE_GLYPH } from '../../../src/lib/theme/motionValues'

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
  // 26 and no more: the bar lays each icon out in a 31 by 28 slot, and a
  // glyph taller than that spills onto the word under it.
  const icon = <Feather name={name} size={26} color={color} />
  /*
   * Padded, and a rounded square rather than a circle: a hole that hugs a
   * 26-point glyph reads as a speck, not as "this tab", and a circle around a
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
const ECHO_GLYPH = 26
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
 * The redesign's bar, behind `flags.v3Home`: Home · Chats · Echo · People ·
 * Me, drawn from the design canvas's tab bar.
 *
 * The tab you are on sits in a grey pill; the rest are the muted glyph alone.
 * Echo included: an always-on blue pill under Echo read on a phone as a
 * second selected tab, so Echo is told apart by its due-count badge and its
 * centre place, never by a layer of its own (_The Echo tab drops its
 * standing tint_ in `docs/decisions.md`).
 *
 * The pill is 56 by 32, so the icon slot is widened to hold it rather than
 * the glyph spilling out of the 31 by 28 the bar lays out by default.
 */
const V3_PILL = { width: 56, height: 32 } as const

/** The bar above the bottom inset: the pill, the word and the padding round them. */
const V3_BAR_HEIGHT = 62

/** A badge in the redesign's bar: the count as drawn, and the number behind it. */
interface V3Badge {
  text: string | undefined
  count: number | undefined
  look: 'blue' | 'pill'
}

/*
 * The bar draws every icon twice, an active copy over an inactive one, and
 * swaps their opacity in one frame — so the `focused` it passes says which
 * copy this is, not whether the tab is on. The pill follows the tab's real
 * focus instead (`useIsFocused`: each item sits under its own route's
 * navigation), in both copies alike, so whichever copy is showing shows it
 * arriving or leaving. The glyph's colour still swaps with the copies.
 *
 * On RN `Animated` with the native driver: the tab bar is on the launch path.
 */
function V3TabIcon({
  name,
  focused,
  tour,
  badge,
}: {
  name: keyof typeof Feather.glyphMap
  focused: boolean
  tour?: TourTargetId
  badge?: V3Badge
}) {
  const styles = useV3Styles()
  const { v3 } = useTheme()
  const on = useIsFocused()
  const reduce = useReduceMotion()
  const shown = useRef(new Animated.Value(on ? 1 : 0)).current
  useEffect(() => {
    const toValue = on ? 1 : 0
    if (reduce) {
      shown.setValue(toValue)
      return
    }
    // In at `fade`'s 200 ms, out quicker at `release`'s 150: nobody watches
    // the tab they are leaving.
    Animated.timing(shown, {
      toValue,
      duration: on ? DURATION.fade : DURATION.release,
      easing: EASE_OUT,
      useNativeDriver: true,
    }).start()
  }, [on, reduce, shown])
  const pill = (
    <View style={styles.pill}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.pillOn,
          {
            opacity: shown,
            transform: [
              { scale: shown.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) },
            ],
          },
        ]}
      />
      <Feather name={name} size={v3.icon.xl} color={focused ? v3.colors.fg : v3.colors.muted} />
    </View>
  )
  return (
    <View style={styles.pill}>
      {tour ? (
        <TourTarget id={tour} pad={4} radius={v3.radius.pill}>
          {pill}
        </TourTarget>
      ) : (
        pill
      )}
      {badge ? <V3TabBadge {...badge} /> : null}
    </View>
  )
}

/**
 * The count on a tab, drawn here rather than by the bar's own badge so it can
 * pop — 1 → 1.18 → 1 — when the number goes up, and only then: a count
 * falling is somebody catching up, which needs no fanfare, and the first
 * number a launch shows is not news either (`badgeGrew`).
 *
 * Where the bar put its own: three points over the slot's top end corner.
 */
function V3TabBadge({ text, count, look }: V3Badge) {
  const { v3 } = useTheme()
  const reduce = useReduceMotion()
  const scale = useRef(new Animated.Value(1)).current
  const previous = useRef(count)
  useEffect(() => {
    const grew = badgeGrew(previous.current, count)
    previous.current = count
    if (!grew || reduce) return
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.18,
        duration: DURATION.press,
        easing: EASE_OUT,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: DURATION.release,
        easing: EASE_OUT,
        useNativeDriver: true,
      }),
    ]).start()
  }, [count, reduce, scale])
  if (!text) return null
  return (
    <Animated.Text
      numberOfLines={1}
      // As the bar's own badge: iOS shows the large-content viewer instead.
      allowFontScaling={Platform.OS === 'ios' ? false : undefined}
      style={[
        v3TabBadgeStyle(
          v3.type.label,
          look === 'blue' ? v3.colors.blue : v3.colors.pill,
          look === 'blue' ? v3.colors.onBlue : v3.colors.pillText,
        ),
        BADGE_BOX,
        { transform: [{ scale }] },
      ]}
    >
      {text}
    </Animated.Text>
  )
}

const BADGE_BOX = {
  borderRadius: TAB_BADGE_SIZE / 2,
  end: -3,
  minWidth: TAB_BADGE_SIZE,
  overflow: 'hidden',
  paddingHorizontal: 4,
  position: 'absolute',
  top: -3,
} as const

/*
 * The redesign's tab press: the shared `PressableScale`, not the bar's
 * `PlatformPressable`, whose 0.3 dim was the one press in the app that
 * looked unlike every other. The glyph scale, because the face is a glyph
 * and its word. No haptic: a tab switch is plain navigation
 * (`lib/haptics.ts`). The bar's own link, ripple and hover are dropped; the
 * press navigates through `onPress` either way.
 */
type V3TabButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  href?: string
  pressOpacity?: number
  hoverEffect?: unknown
}

function V3TabButton({
  children,
  style,
  href: _href,
  pressOpacity: _pressOpacity,
  hoverEffect: _hoverEffect,
  android_ripple: _ripple,
  ...rest
}: V3TabButtonProps) {
  return (
    <PressableScale {...rest} touchStyle={style} style={TAB_FACE} scaleTo={PRESS_SCALE_GLYPH}>
      {children}
    </PressableScale>
  )
}

const TAB_FACE = { alignItems: 'center' } as const

const useV3Styles = makeStyles(({ v3 }) => ({
  pill: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    height: V3_PILL.height,
    justifyContent: 'center',
    width: V3_PILL.width,
  },
  pillOn: { backgroundColor: v3.colors.tabOn, borderRadius: v3.radius.pill },
}))

/**
 * The five tabs, and only the five tabs — one of two sets of five.
 *
 * The rule the number is standing in for is the one that matters, and adding
 * Echo did not touch it, nor does the second set: nothing that is not a tab
 * may be registered here.
 *
 * Every other signed-in screen used to be registered here too, as a
 * `Tabs.Screen` with `href: null` and a hidden bar — which made them tabs
 * rather than stack entries. A tab navigator has no stack: pushing one
 * *switched* to it, nothing was pushed, so there was nothing for iOS's swipe
 * gesture to pop and every back control was a `router.replace`. They are stack
 * screens now, in the layout above this one; this navigator is the stack's
 * first entry.
 *
 * **Which five is `flags.v3Home`'s** (`useV3Home`, read once per launch).
 * Off — the default, and every build older than the flag — it is today's
 * Discover · Chats · Echo · Feed · Me. On, it is the redesign's Home · Chats ·
 * Echo · People · Me: People is the `discover` route under a new word, with
 * Discover and Feed as its two segments, so every link and push that names
 * `/discover` still lands. Each set registers the other's odd one out with
 * `href: null` — expo-router makes a tab of every file in this folder, and a
 * hidden one is the only way for a route to exist without a button. They are
 * still tabs, not stack screens, so the rule above holds: `feed` redirects to
 * People's Posts segment when hidden, and `home` to Discover.
 */
export default function TabsLayout() {
  const { colors, v3 } = useTheme()
  const t = useT()
  const v3Home = useV3Home()
  const insets = useSafeAreaInsets()
  const { data: session } = authClient.useSession()
  // A guest has no conversations, so asking for a total would be a request
  // that can only ever answer zero.
  const unread = useUnreadTotal(!shouldGateGuest(session?.user))
  // Spread rather than passed as `undefined`: the option is typed as present
  // or absent, and an explicit `undefined` is neither.
  const badge = unreadBadge(unread.data)
  /*
   * The bell's number, on the tab as well as in the Me header.
   *
   * Same guest gate and the same reason: a guest follows nobody and posts
   * nothing, so the request could only ever answer zero — and would 401
   * rather than answer it.
   */
  const meCount = useNotificationUnread(!shouldGateGuest(session?.user)).data
  const meBadge = unreadBadge(meCount)
  /*
   * Cards due. Same guest gate: a guest has no cards, and the request would
   * 401 rather than answer zero.
   */
  const echoDue = useEchoSummary(!shouldGateGuest(session?.user)).data?.due
  const echoBadge = unreadBadge(echoDue)
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

  if (v3Home) {
    return (
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: v3.colors.fg,
          tabBarInactiveTintColor: v3.colors.muted,
          tabBarShowLabel: true,
          tabBarLabelStyle: v3.type.label,
          tabBarLabelPosition: 'below-icon',
          tabBarIconStyle: V3_PILL,
          tabBarButton: (props) => <V3TabButton {...props} />,
          /*
           * A tab out of sight stops rendering until it is back: every socket
           * patch used to re-render all five, the four nobody was looking at
           * included. Updates queued meanwhile land when it is focused again.
           */
          freezeOnBlur: true,
          /*
           * Taller than the bar's own 49: the pill is 32 and the word under it
           * 16, which the default height clips. A custom height replaces the
           * bar's whole sum, so the bottom inset is added back here.
           */
          tabBarStyle: {
            backgroundColor: v3.colors.bg,
            borderTopColor: v3.colors.line,
            height: V3_BAR_HEIGHT + insets.bottom,
          },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: t('tabs.home'),
            tabBarIcon: ({ focused }) => <V3TabIcon name="home" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="chats"
          options={{
            title: t('tabs.chats'),
            // Blue, as the drawing has it: in this bar a count is news, and
            // red is kept for what went wrong.
            tabBarIcon: ({ focused }) => (
              <V3TabIcon
                name="message-square"
                focused={focused}
                tour="tabChats"
                badge={{ text: badge, count: unread.data, look: 'blue' }}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="echo"
          options={{
            title: t('tabs.echo'),
            tabBarIcon: ({ focused }) => (
              <V3TabIcon
                name="repeat"
                focused={focused}
                tour="tabEcho"
                badge={{ text: echoBadge, count: echoDue, look: 'pill' }}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="discover"
          options={{
            title: t('tabs.people'),
            tabBarIcon: ({ focused }) => <V3TabIcon name="users" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="me"
          options={{
            title: t('tabs.me'),
            tabBarIcon: ({ focused }) => (
              <V3TabIcon
                name="user"
                focused={focused}
                badge={{ text: meBadge, count: meCount, look: 'blue' }}
              />
            ),
          }}
        />
        {/* People's Posts segment now; reached by a link, it redirects there. */}
        <Tabs.Screen name="feed" options={{ href: null }} />
      </Tabs>
    )
  }

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
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: t('tabs.me'),
          tabBarIcon: ({ color }) => <TabIcon name="user" color={color} />,
          /*
           * The notification centre lives behind the bell in this tab's
           * header, so the tab is where its count has to show — somebody on
           * Chats has no other way of learning there is anything to read.
           * Spread rather than passed as `undefined`, like the badge above.
           */
          ...(meBadge
            ? {
                tabBarBadge: meBadge,
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
      {/* The redesign's Home, behind `flags.v3Home`; reached by a link, it redirects to Discover. */}
      <Tabs.Screen name="home" options={{ href: null }} />
    </Tabs>
  )
}
