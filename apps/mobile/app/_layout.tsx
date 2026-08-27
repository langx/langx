import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useRef, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ApiRequestError } from '../src/api/client'
import { AppGate } from '../src/components/AppGate'
import { authClient } from '../src/lib/auth-client'
import { colors } from '../src/lib/theme'

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
  const { data: session, isPending } = authClient.useSession()
  const [queryClient] = useState(createQueryClient)

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
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="auto" />
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
          </AppGate>
        )}
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}
