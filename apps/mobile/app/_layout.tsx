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
import Head from 'expo-router/head'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useRef, useState } from 'react'
import { Platform, Text } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { isRequestTimeout } from '../src/api/apiFetch'
import { ApiRequestError } from '../src/api/client'
import { AlertHost } from '../src/components/AlertHost'
import { MessageMenuHost } from '../src/components/MessageMenuHost'
import { AppGate } from '../src/components/AppGate'
import { AppSplash, SplashFill } from '../src/components/AppSplash'
import { KeyboardResizeHost } from '../src/components/KeyboardResizeHost'
import { Button } from '../src/components/ui/Button'
import { MessageBannerHost } from '../src/components/MessageBannerHost'
import { ToastHost } from '../src/components/ToastHost'
import { TourHost } from '../src/components/TourHost'
import { WebTitle } from '../src/components/WebTitle'
import { authClient } from '../src/lib/auth-client'
import { useGuestSessionReset } from '../src/hooks/useGuestSessionReset'
import { usePendingInvite } from '../src/hooks/usePendingInvite'
import { useCompanionOpenTracking } from '../src/hooks/useCompanionOpenTracking'
import { shouldGateGuest } from '../src/lib/guestGate'
import { forgetPurchasesIdentity, identifyForPurchases } from '../src/lib/purchases'
import { forgetAnalyticsIdentity, identifyForAnalytics, startAnalytics } from '../src/lib/analytics'
import { markInstalled } from '../src/lib/installedAt'
import { ensurePlaybackAudioMode } from '../src/lib/audioSession'
import { configureObserve } from '../src/lib/observe'
import { configureQueryNetwork } from '../src/lib/queryNetwork'
import { PERSIST_MAX_AGE_MS } from '../src/lib/queryPersistence'
import { keepUnwatchedThreadsShort } from '../src/lib/queryLifetimes'
import { forgetPersistedQueries, usePersistedQueries } from '../src/hooks/usePersistedQueries'
import { useScreenTracking } from '../src/hooks/useScreenTracking'
import { isAccountSwitch } from '../src/lib/sessionSwitch'
import { clearCompanionDirectory, clearCompanionSnapshot } from '../modules/companion-snapshot'
import { clearWatch } from '../modules/watch-link'
import { clearWear } from '../modules/wear-link'
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

/*
 * And what the radio is doing, for the same "read once, before anything needs
 * it" reason. Module scope because `onlineManager`'s listener is global and
 * setting it twice would leave the first subscription running.
 */
configureQueryNetwork()

function createQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        /*
         * A week, to match the persisted cache's `maxAge`: the persister only
         * writes what the client is still holding, and restores into queries
         * that are collected on this timer. At the default five minutes a
         * thread left for that long was collected — hence the skeleton on
         * reopening it — and a restored copy would have gone the same way
         * before anyone came back for it. `usePersistedQueries` has the rest,
         * and `keepUnwatchedThreadsShort` below pays for what a week of every
         * loaded page would otherwise cost.
         */
        gcTime: PERSIST_MAX_AGE_MS,
        retry: (failureCount, error) => {
          // Retrying a 4xx just repeats the same refusal. Only transient
          // failures — network, 5xx — are worth a second attempt.
          if (error instanceof ApiRequestError && error.status < 500) return false
          /*
           * One extra attempt for a timeout, not two. Each one costs the full
           * ten seconds before anything can appear on screen, and the case
           * this exists for — a tunnel, a captive portal — will not answer the
           * third either. A phone that is merely slow still gets its second
           * chance.
           */
          if (isRequestTimeout(error)) return failureCount < 1
          return failureCount < 2
        },
      },
    },
  })
  keepUnwatchedThreadsShort(client)
  return client
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
      {/*
       * The touch icon is what iOS uses for a home-screen shortcut and in
       * Safari's own tab and favourites grids. The favicon is linked as a PNG
       * and at a new URL: the first `/favicon.ico` this site shipped was one
       * Firefox could not decode (see app.config.ts), and a browser keeps a
       * failed favicon in its own cache, so the repaired file at the old
       * address could stay invisible to it for days. `public/favicon.ico` is
       * still there for anything that asks for that path unprompted.
       * The title is `WebTitle`, further in,
       * because it needs the query client for the unread count. Web only, like
       * that one: `Head` on iOS is Handoff, not a document head.
       */}
      {Platform.OS === 'web' ? (
        <Head>
          <link rel="icon" type="image/png" sizes="64x64" href="/favicon.png" />
          <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        </Head>
      ) : null}
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
  useCompanionOpenTracking()

  /*
   * Reads the stored opt-out and, unless it says no, starts the SDK. Nothing
   * is sent until that answer is in; the screens captured meanwhile wait
   * behind it. Screens are captured from here, above the navigator, for the
   * same reason the socket is opened in the app layout: a hook inside a
   * screen misses every screen it is not on.
   */
  useEffect(() => {
    void startAnalytics()
    // The device's own record of its first launch, which is the only thing
    // that can tell `onboarding_completed` how long the first minute took.
    void markInstalled()
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
  const email = session?.user?.email
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
      // The email is the web checkout's only extra: RevenueCat collects one
      // there whatever we do — it is how the receipt and the cancellation link
      // are sent — so handing over the account's saves the buyer a field
      // rather than disclosing anything the purchase would not have carried.
      // The native SDKs ignore it; Apple and Google know who is paying.
      void identifyForPurchases(userId, email)
      // The same rule for the same reason: analytics keyed by our user id is
      // what makes a deleted account's events findable, and a guest's id is
      // thrown away at registration.
      identifyForAnalytics(userId)
    } else {
      void forgetPurchasesIdentity()
      forgetAnalyticsIdentity()
    }
    // `email` too, so that changing it re-prefills the web checkout. The call
    // is a no-op for the id it is already bound to, so this costs nothing.
  }, [userId, email])

  /**
   * Empties everything the last account left behind, wherever it left it.
   *
   * **The query cache**, because the client is made once and this tree never
   * unmounts, so every answer fetched for one account is still sitting in it
   * when the next one arrives: signing out and browsing as a guest showed the
   * previous account's conversations, because `useConversations` is handed
   * its cached pages before the guest's own (empty) list can come back. Not
   * only chats — `keys.me`, the feed and discovery are all cached the same
   * way. `clear()` rather than `invalidateQueries()`: invalidating leaves the
   * data in place and merely refetches it, which still paints somebody else's
   * rows first and leaves them there for good if the refetch fails.
   *
   * **And the companion surfaces**, which are the same problem on hardware
   * the app does not own the screen of — a widget, an Apple Watch, a Wear OS
   * watch. Each holds a blob the app wrote and redraws it on its own
   * schedule, so a signed-out account's streak and unread count stay on a
   * Home Screen or a wrist until something says otherwise. The App Intents'
   * conversation directory goes with them, and it is the one that matters
   * most: the others are somebody's numbers, that one is their friends' names.
   *
   * **At the root rather than in `signOut()`**, and that placement is the
   * whole fix. The widget snapshot was cleared in the sign-out button, which
   * covered one of four exits; the two watches were cleared in `useWatchLink`
   * when its `enabled` went false, which covered **none** — signing out
   * unmounts `(app)/_layout`, so that effect's body never runs again and only
   * its cleanup does. A cookie that expired, a deleted account and the
   * suspended screen all end a session without passing through the button
   * either. This runs on all four, because it watches the session rather than
   * the gesture.
   */
  const seenUserId = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    const current = userId ?? null
    const previous = seenUserId.current
    if (isAccountSwitch(previous, current)) {
      queryClient.clear()
      // And its copy on disk, or the next launch would restore what `clear()`
      // just emptied. `previous` is a real id here: `isAccountSwitch` is false
      // for anything else.
      if (previous) void forgetPersistedQueries(previous)
      clearCompanionSnapshot()
      clearCompanionDirectory()
      clearWatch()
      clearWear()
    }
    seenUserId.current = current
  }, [userId, queryClient])

  /*
   * After the effect above, and it matters: see the hook for the order React
   * runs these in. Never for a guest — a guest's account is thrown away at
   * registration or swept, and a cache written for it would outlive it.
   */
  usePersistedQueries(queryClient, isGuest ? undefined : userId)

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
        <WebTitle />
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
              Around the whole tree, because it stands in for the window
              resize Android used to do for the keyboard — see the component.
              The dialog hosts are Modals, which are windows of their own and
              pad for the keyboard themselves.
            */}
            <KeyboardResizeHost>
              {/*
                Above the navigator, not inside a screen: the delete-account flow
                signs out while its own confirmation is still open, and a dialog
                owned by a screen dies with it.
              */}
              <AlertHost />
              <MessageMenuHost />
              {/*
                Above the navigator with the other two dialogs, and a Modal like
                them: the tour dims the tab bar as well as the screen, and it has
                to outlive the screen that started it — the Settings row that
                replays it navigates while the run is being set up.
              */}
              <TourHost />
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
                {/* The verification link, for the same reason. */}
                <Stack.Screen name="verify-email" options={{ gestureEnabled: false }} />
                {/*
                  Outside both guards for the same reason, from the other end: a
                  suspended account still holds a perfectly good session — that
                  is what a suspension is — so the guard has nothing to say about
                  this screen, and the transport `replace`s here from wherever
                  the 403 was met.
                */}
                <Stack.Screen name="suspended" options={{ gestureEnabled: false }} />
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
            </KeyboardResizeHost>
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
