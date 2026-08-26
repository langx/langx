import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useRef } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { authClient } from '../src/lib/auth-client'

export default function RootLayout() {
  const { data: session, isPending } = authClient.useSession()

  // useSession() sets isPending on every refetch, not just the first load —
  // sign-up, sign-in and sign-out all trigger one. Gating the whole <Stack>
  // on isPending unmounts and remounts it each time, which resets whatever
  // route Stack.Protected's now-hidden branch was on (e.g. a router.replace
  // to check-email lands, then vanishes the moment the post-signup refetch
  // flips isPending true again). Only the very first resolution should hide
  // the tree; every refetch after that keeps rendering the last known route.
  const hasResolvedOnce = useRef(false)
  if (!isPending) hasResolvedOnce.current = true
  const showSpinner = isPending && !hasResolvedOnce.current

  return (
    <>
      <StatusBar style="auto" />
      {showSpinner ? (
        <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      ) : (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={!!session}>
            <Stack.Screen name="index" />
          </Stack.Protected>
          <Stack.Protected guard={!session}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
        </Stack>
      )}
    </>
  )
}
