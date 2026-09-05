/**
 * The two weights, by subpath.
 *
 * The package root is a barrel whose `export const … = require(…)` lines all
 * evaluate on import, so pulling one weight from it bundles every other one —
 * hundreds of KB of TTF to use a fraction of it, in the web bundle and in
 * every store binary. Each subpath requires exactly one file.
 */
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold'
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold'
import { useFonts } from 'expo-font'
import { ObserveRoot } from 'expo-observe'
import * as SplashScreen from 'expo-splash-screen'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useRef, useState } from 'react'
import { Text } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ApiRequestError } from '../src/api/client'
import { AlertHost } from '../src/components/AlertHost'
import { MessageMenuHost } from '../src/components/MessageMenuHost'
import { AppGate } from '../src/components/AppGate'
import { AppSplash, SplashFill } from '../src/components/AppSplash'
import { Button } from '../src/components/ui/Button'
import { MessageBannerHost } from '../src/components/MessageBannerHost'
import { ToastHost } from '../src/components/ToastHost'
import { authClient } from '../src/lib/auth-client'
import { useGuestSessionReset } from '../src/hooks/useGuestSessionReset'
import { usePendingInvite } from '../src/hooks/usePendingInvite'
import { shouldGateGuest } from '../src/lib/guestGate'
import { forgetPurchasesIdentity, identifyForPurchases } from '../src/lib/purchases'
import { forgetAnalyticsIdentity, identifyForAnalytics, startAnalytics } from '../src/lib/analytics'
import { ensurePlaybackAudioMode } from '../src/lib/audioSession'
import { configureObserve } from '../src/lib/observe'
import { useScreenTracking } from '../src/hooks/useScreenTracking'
import { isAccountSwitch } from '../src/lib/sessionSwitch'
import { ThemeProvider, useTheme } from '../src/lib/theme'
import { I18nProvider, useT } from '../src/i18n'

/**
 * How long the launch spinner is allowed to mean "nearly there" before it has
 * to admit it is waiting on something that may never arrive.
 *
 * Nothing below has a timeout: `useSession` clears `isPending` only when the
 * `/get-session` round-trip settles, and a stalled socket never settles. Ten
 * seconds is far longer than a slow answer and far shorter than forever.
 */
const BOOT_STALL_MS = 10_000

/*
 * Global scope on purpose. The package's own doc says so, and the reason is
 * that by the time an effect could run the native splash may already have
 * auto-hidden — which is precisely the blank frame this exists to remove. A
 * no-op on the web: expo-splash-screen's non-native build returns `false` from
 * every export, which is why there is no `Platform` branch here.
 */
void SplashScreen.preventAutoHideAsync().catch(() => undefined)

/*
 * Module scope, and it has to be: the `expo-router` integration is read once
 * when `ObserveRoot`'s provider mounts and throws if the answer changes after
 * that, so there is no effect early enough to do this in.
 */
configureObserve()

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) => {
          // Retrying a 4xx just repeats the same refusal. Only transient
          // failures — network, 5xx — are worth a second attempt.
          if (error instanceof ApiRequestError && error.status < 500) return false
          return failureCount < 2
        },
      },
    },
  })
}

function RootLayout() {
  return (
    /*
     * Outside `SafeAreaProvider`, which is where gesture-handler's own docs put
     * it: it has to be the outermost view for a gesture anywhere in the tree to
     * be recognised. `flex: 1` is required — without it the view collapses and
     * the whole app renders as nothing.
     */
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nProvider>
          <ThemeProvider>
            <RootShell />
          </ThemeProvider>
        </I18nProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

/**
 * EAS Observe's root. The HOC times the launch itself — the gap between the
 * process starting and this tree's first render (Time to First Render) — which
 * is why it wraps the default export rather than being mounted as a provider
 * somewhere inside it: anything below has already cost the measurement the
 * part it exists to measure.
 *
 * Time to Interactive is *not* marked here. With the `expo-router`
 * integration on, `markInteractive` is attributed to whichever route it is
 * called from, and this component sits above the navigator — there is no route
 * here to attribute it to. Each screen asks for its own; see
 * `useScreenInteractive`.
 *
 * A no-op where there is no native module: `expo-observe` ships a web shim
 * whose every method returns without doing anything, so the static web export
 * and its prerender pass are unaffected. Metrics from debug builds are also
 * held back unless `dispatchInDebug` is turned on in `configureObserve`, so
 * what this reports is production only.
 */
export default ObserveRoot.wrap(RootLayout)

/**
 * Split from `RootLayout` only so it sits *inside* `ThemeProvider` and can call
 * `useTheme()` — the splash background and the status-bar style both have to
 * follow the theme, and a provider cannot consume itself.
 */
function RootShell() {
  const { colors, scheme } = useTheme()
  const t = useT()
  const { data: session, isPending, refetch } = authClient.useSession()
  const [queryClient] = useState(createQueryClient)

  /*
   * Above everything else that reads the session: a guest session that
   * outlived the app being closed is ended here, before the navigator can be
   * built around it. See the hook for what that state does to routing.
   */
  const { resetting } = useGuestSessionReset()

  // Above `Stack.Protected`, because an invite link is by definition opened by
  // somebody with no account. It only writes a flag; see the hook for why that
  // is what makes mounting it this high safe.
  usePendingInvite()

  /*
   * Reads the stored opt-out and, unless it says no, starts the SDK. Nothing
   * is sent until that answer is in; the screens captured meanwhile wait
   * behind it. Screens are captured from here, above the navigator, for the
   * same reason the socket is opened in the app layout: a hook inside a
   * screen misses every screen it is not on.
   */
  useEffect(() => {
    void startAnalytics()
    /*
     * And the audio session, for the same "before anything needs it" reason.
     * A voice note played by someone who has not recorded in this session used
     * to land in iOS's ambient category, which the ringer switch mutes — see
     * `lib/audioSession.ts`. Setting it once at start means the first tap on
     * the first note is already right; `AudioBubble` asks again on play,
     * because recording flips it back.
     */
    void ensurePlaybackAudioMode()
  }, [])
  useScreenTracking()

  /**
   * Binds RevenueCat and analytics to the signed-in account, and unbinds on
   * sign-out.
   *
   * This lives at the root rather than on the paywall because the identity has
   * to be right *before* a purchase is possible, not at the moment one is
   * attempted: a purchase made under an anonymous RevenueCat id is real on the
   * store and invisible to this app, and no amount of later logIn() moves it.
   * Everything it calls is a no-op when billing is unconfigured, so this costs
   * nothing on web or in a build without the native module.
   */
  const userId = session?.user?.id
  const isGuest = shouldGateGuest(session?.user)
  useEffect(() => {
    /*
     * Never for a guest. RevenueCat's `app_user_id` must equal the Better Auth
     * user id, and a guest's is thrown away at registration — identifying here
     * would mint a customer per guest under an id that stops existing, and no
     * later `logIn` can move a purchase made under it. Guests cannot buy
     * anything anyway; the paywall's buy button is behind `requireAccount`.
     */
    if (userId && !isGuest) {
      void identifyForPurchases(userId)
      // The same rule for the same reason: analytics keyed by our user id is
      // what makes a deleted account's events findable, and a guest's id is
      // thrown away at registration.
      identifyForAnalytics(userId)
    } else {
      void forgetPurchasesIdentity()
      forgetAnalyticsIdentity()
    }
  }, [userId])

  /**
   * Empties the query cache when the person behind it changes.
   *
   * The client is made once and this tree never unmounts, so without this
   * every answer fetched for one account survives into the next session:
   * signing out and browsing as a guest showed the previous account's
   * conversations, because `useConversations` is handed its cached pages
   * before the guest's own (empty) list can come back. Not only chats —
   * `keys.me`, the feed and discovery are all cached the same way.
   *
   * `clear()` rather than `invalidateQueries()`: invalidating leaves the data
   * in place and merely refetches it, which still paints somebody else's rows
   * first and leaves them there for good if the refetch fails.
   *
   * At the root rather than in `signOut()` because sign-out is not the only
   * way the session changes hands — an expired cookie ends one without
   * passing through that button, and `sign-up.tsx` ends a guest's.
   */
  const seenUserId = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    const current = userId ?? null
    if (isAccountSwitch(seenUserId.current, current)) queryClient.clear()
    seenUserId.current = current
  }, [userId, queryClient])

  // useSession() sets isPending on every refetch, not just the first load —
  // sign-up, sign-in and sign-out all trigger one. Gating the whole <Stack>
  // on isPending unmounts and remounts it each time, which resets whatever
  // route Stack.Protected's now-hidden branch was on (e.g. a router.replace
  // to check-email lands, then vanishes the moment the post-signup refetch
  // flips isPending true again). Only the very first resolution should hide
  // the tree; every refetch after that keeps rendering the last known route.
  const hasResolvedOnce = useRef(false)
  if (!isPending) hasResolvedOnce.current = true

  /**
   * Nunito is display-only, so a missed load costs headings their voice and
   * nothing else. `fontError` is therefore treated as "carry on" rather than a
   * failure: shipping the platform stack is far better than holding the splash
   * open on a font that is never going to arrive.
   */
  const [fontsLoaded, fontError] = useFonts({ Nunito_700Bold, Nunito_800ExtraBold })
  const showSpinner =
    (isPending && !hasResolvedOnce.current) || (!fontsLoaded && !fontError) || resetting

  /**
   * The way out of a spinner that is never going to end.
   *
   * Every condition above waits on something with no timeout of its own, and
   * the branch below draws an `ActivityIndicator` and nothing else — so a
   * request that hangs rather than fails leaves the app with no screen, no
   * error and no button, which is what a stranger opening it for the second
   * time actually hit. After `BOOT_STALL_MS` the spinner keeps spinning but
   * gains a way to ask again.
   */
  const [stalled, setStalled] = useState(false)
  // `stalled` is a dependency as well as the thing set: pressing "try again"
  // clears it, and that has to start the clock over rather than spend the
  // button.
  useEffect(() => {
    if (!showSpinner) {
      setStalled(false)
      return
    }
    if (stalled) return
    const timer = setTimeout(() => setStalled(true), BOOT_STALL_MS)
    return () => clearTimeout(timer)
  }, [showSpinner, stalled])

  return (
    <>
      <QueryClientProvider client={queryClient}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        {showSpinner ? (
          <SplashFill>
            {stalled ? (
              <>
                <Text style={{ color: colors.textMuted, textAlign: 'center' }}>
                  {t('common.retry')}
                </Text>
                <Button
                  label={t('common.tryAgain')}
                  onPress={() => {
                    setStalled(false)
                    void refetch()
                  }}
                  style={{ minWidth: 200 }}
                />
              </>
            ) : null}
          </SplashFill>
        ) : (
          <AppGate>
            {/*
              Above the navigator, not inside a screen: the delete-account flow
              signs out while its own confirmation is still open, and a dialog
              owned by a screen dies with it.
            */}
            <AlertHost />
            <MessageMenuHost />
            <Stack screenOptions={{ headerShown: false }}>
              {/*
                Outside both guards, because it *is* the guard: `index` is the
                only screen at `/` in every state, and it reads the session
                itself. Behind `!!session` it was one of two screens matching
                the empty path, and which one answered a returning guest was
                decided by route-file order.
              */}
              {/*
                No swipe between the groups. They switch by `replace` and
                `<Redirect>`, so there is nothing to pop to today — this is
                what keeps a future `push` from ever swiping a signed-in user
                back onto the sign-in form.
              */}
              <Stack.Screen name="index" options={{ gestureEnabled: false }} />
              {/*
                Also outside both guards: the emailed sign-in link lands here
                whoever taps it, and a signed-in member tapping it must not
                fall through to `[username]` because `(auth)` is unmounted.
              */}
              <Stack.Screen name="magic-link" options={{ gestureEnabled: false }} />
              <Stack.Protected guard={!!session}>
                <Stack.Screen name="(onboarding)" options={{ gestureEnabled: false }} />
                <Stack.Screen name="(app)" options={{ gestureEnabled: false }} />
              </Stack.Protected>
              {/*
                `!session` alone was right while every session meant an account.
                A guest holds one, so `(auth)` would unmount and "send them to
                sign up" would have nowhere to go. Both branches mount for a
                guest, which is exactly the state they are in: browsing inside
                `(app)`, one tap away from `(auth)`.
              */}
              <Stack.Protected guard={!session || isGuest}>
                <Stack.Screen name="(auth)" options={{ gestureEnabled: false }} />
              </Stack.Protected>
            </Stack>
            {/*
              After the navigator, not before it: this one is a plain
              positioned view rather than a Modal, so painting over the screen
              is a matter of coming later in the tree.
            */}
            <ToastHost />
            {/*
              Last, so it paints over the toast as well: a message arriving is
              the more urgent of the two, and both at once is rare enough that
              the toast losing four seconds costs nothing.
            */}
            <MessageBannerHost />
          </AppGate>
        )}
        {/*
          Outside the branch above, so it is on screen from the very first
          render — before the session resolves and before the fonts land. That
          ordering is what lets the native splash be torn down without a blank
          frame between the two. It also sits above the navigator, so it
          outlives `index` redirecting into onboarding or `(app)`.

          Its own five-second fallback is deliberately shorter than
          `BOOT_STALL_MS`: the logo gets out of the way first, and the retry
          this branch offers appears under it rather than behind it.
        */}
        <AppSplash />
      </QueryClientProvider>
    </>
  )
}
