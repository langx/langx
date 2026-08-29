/**
 * The single weight, by subpath.
 *
 * The package root is a barrel whose five `export const … = require(…)` lines
 * all evaluate on import, so pulling one weight from it bundles the other four
 * — 560K of TTF to use 112K of it, in the web bundle and in every store
 * binary. `700Bold/index.js` requires exactly one file.
 */
import { Comfortaa_700Bold } from '@expo-google-fonts/comfortaa/700Bold'
import { useFonts } from 'expo-font'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ApiRequestError } from '../src/api/client'
import { AlertHost } from '../src/components/AlertHost'
import { MessageMenuHost } from '../src/components/MessageMenuHost'
import { AppGate } from '../src/components/AppGate'
import { ToastHost } from '../src/components/ToastHost'
import { authClient } from '../src/lib/auth-client'
import { forgetPurchasesIdentity, identifyForPurchases } from '../src/lib/purchases'
import { ThemeProvider, useTheme } from '../src/lib/theme'

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

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootShell />
      </ThemeProvider>
    </SafeAreaProvider>
  )
}

/**
 * Split from `RootLayout` only so it sits *inside* `ThemeProvider` and can call
 * `useTheme()` — the splash background and the status-bar style both have to
 * follow the theme, and a provider cannot consume itself.
 */
function RootShell() {
  const { colors, scheme } = useTheme()
  const { data: session, isPending } = authClient.useSession()
  const [queryClient] = useState(createQueryClient)

  /**
   * Binds RevenueCat to the signed-in account, and unbinds on sign-out.
   *
   * This lives at the root rather than on the paywall because the identity has
   * to be right *before* a purchase is possible, not at the moment one is
   * attempted: a purchase made under an anonymous RevenueCat id is real on the
   * store and invisible to this app, and no amount of later logIn() moves it.
   * Everything it calls is a no-op when billing is unconfigured, so this costs
   * nothing on web or in a build without the native module.
   */
  const userId = session?.user?.id
  useEffect(() => {
    if (userId) void identifyForPurchases(userId)
    else void forgetPurchasesIdentity()
  }, [userId])

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
   * Comfortaa is display-only, so a missed load costs headings their voice and
   * nothing else. `fontError` is therefore treated as "carry on" rather than a
   * failure: shipping the platform stack is far better than holding the splash
   * open on a font that is never going to arrive.
   */
  const [fontsLoaded, fontError] = useFonts({ Comfortaa_700Bold })
  const showSpinner = (isPending && !hasResolvedOnce.current) || (!fontsLoaded && !fontError)

  return (
    <>
      <QueryClientProvider client={queryClient}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        {showSpinner ? (
          <View
            style={{
              alignItems: 'center',
              backgroundColor: colors.bg,
              flex: 1,
              justifyContent: 'center',
            }}
          >
            <ActivityIndicator />
          </View>
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
              <Stack.Protected guard={!!session}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(onboarding)" />
                <Stack.Screen name="(app)" />
              </Stack.Protected>
              <Stack.Protected guard={!session}>
                <Stack.Screen name="(auth)" />
              </Stack.Protected>
            </Stack>
            {/*
              After the navigator, not before it: this one is a plain
              positioned view rather than a Modal, so painting over the screen
              is a matter of coming later in the tree.
            */}
            <ToastHost />
          </AppGate>
        )}
      </QueryClientProvider>
    </>
  )
}
