import { Stack } from 'expo-router'
import { View } from 'react-native'
import { DeletionBanner } from '../../src/components/DeletionBanner'
import { useTheme } from '../../src/lib/theme'
import { useNotificationRouting } from '../../src/hooks/useNotificationRouting'
import { usePushRegistration } from '../../src/hooks/usePushRegistration'
import { useLocationRefresh } from '../../src/hooks/useLocationRefresh'
import { useDailyCheckIn } from '../../src/hooks/useDailyCheckIn'
import { authClient } from '../../src/lib/auth-client'
import { shouldGateGuest } from '../../src/lib/guestGate'
import { useSocket } from '../../src/hooks/useSocket'

/**
 * The signed-in area: a native stack whose first entry is the tab navigator.
 *
 * It was one flat `Tabs` with every detail screen registered as a hidden tab,
 * which meant `router.push('/(app)/settings')` switched tab rather than
 * pushing, so iOS had nothing to swipe back to and every back control was a
 * `router.replace` (see `backHref` for what that did to "back"). A stack is
 * the shape a back gesture needs: detail screens are pushed, `router.back()`
 * pops, Android's system back pops the same entry, and the tab bar is simply
 * not part of the screens above it — no `href: null`, no hidden bar, no
 * bottom inset counted twice.
 *
 * The socket and the push registration are started here, once, for the whole
 * signed-in area — not per screen. A socket opened in the chat screen would
 * miss the message that arrives while the user is on the discovery tab, which
 * is exactly when the unread badge needs to update.
 */
export default function AppLayout() {
  const { colors } = useTheme()
  const { data: session } = authClient.useSession()
  /*
   * None of the five are for a guest, and the first one is not merely pointless
   * — `ws/index.ts` rejects an unverified session outright, and a guest is
   * unverified by construction, so opening the socket here throws for every
   * guest that reaches this layout. It manifests as a blank screen.
   *
   * The other four are simply wrong for them: a guest has no conversations to
   * receive, no device worth registering, nowhere for a notification to route,
   * no location to refresh, and no profile to hold a streak — and the presence
   * heartbeat would make them show up as "online" to real people.
   */
  const isGuest = shouldGateGuest(session?.user)
  useSocket({ enabled: !isGuest })
  useLocationRefresh({ enabled: !isGuest })
  useDailyCheckIn({ enabled: !isGuest })
  usePushRegistration({ enabled: !isGuest })
  // Here rather than in the root layout: every destination a notification has
  // is behind the sign-in gate, so routing from one before there is a session
  // would land on a screen that immediately redirects away.
  useNotificationRouting({ enabled: !isGuest })

  return (
    /*
     * A plain view, not a `SafeAreaView`. This used to inset the top edge for
     * the banner's sake, and `Screen` insets the top edge too — so every
     * screen started two insets down, 118pt on an iPhone 16 Pro, with the
     * title well below the clock. `Screen` keeps its inset (it is the one
     * place that is right for the auth and onboarding groups as well); the
     * banner takes its own when it renders.
     */
    <View style={{ backgroundColor: colors.bg, flex: 1 }}>
      {/* Above the navigator so a pending deletion is visible on every screen. */}
      <DeletionBanner />
      <Stack
        screenOptions={{
          headerShown: false,
          /*
           * The whole screen swipes back, not the 20pt edge strip. Only iOS
           * reads these; Android has the system gesture and web has the
           * header's own arrow.
           */
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
          animation: 'slide_from_right',
        }}
      >
        {/* The root of the area: nothing to pop to, so nothing to swipe to. */}
        <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
        {/*
          Edge-only here: a message bubble's swipe-to-reply is the same
          rightward drag as the full-screen gesture, and the native recognizer
          would win it. The edge is where iOS's own apps keep the gesture when
          the content swipes too.
        */}
        <Stack.Screen name="chat/[id]" options={{ fullScreenGestureEnabled: false }} />
      </Stack>
    </View>
  )
}
