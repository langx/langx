import { LANGUAGES, MINIMUM_AGE, PLAN_LIMITS } from '@langx/shared'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { Button } from '../src/components/ui/Button'
import { authClient } from '../src/lib/auth-client'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000'

type HealthState =
  { kind: 'loading' } | { kind: 'ok'; db: string } | { kind: 'error'; message: string }

/**
 * Only reachable when signed in (see `_layout.tsx`'s `Stack.Protected`).
 * Still doubles as the Faz 0 smoke check — proving `@langx/shared` resolves
 * and the API is reachable — alongside the real session it now shows.
 */
export default function Index() {
  const { data: session } = authClient.useSession()
  const [health, setHealth] = useState<HealthState>({ kind: 'loading' })
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    fetch(`${API_URL}/health`, { signal: controller.signal })
      .then((response) => response.json() as Promise<{ db: string }>)
      .then((body) => {
        setHealth({ kind: 'ok', db: body.db })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setHealth({ kind: 'error', message: error instanceof Error ? error.message : 'unknown' })
      })

    return () => {
      controller.abort()
    }
  }, [])

  async function onSignOut() {
    setSigningOut(true)
    await authClient.signOut()
    setSigningOut(false)
    router.replace('/(auth)/sign-in')
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>LangX v2</Text>
      <Text style={styles.subtitle}>Practice, Learn, Succeed!</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Signed in as</Text>
        <Text style={styles.ok}>{session?.user.email}</Text>
        <Text style={styles.hint}>{session?.user.emailVerified ? 'verified' : 'not verified'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>API</Text>
        {health.kind === 'loading' && <ActivityIndicator />}
        {health.kind === 'ok' && <Text style={styles.ok}>reachable · db {health.db}</Text>}
        {health.kind === 'error' && <Text style={styles.error}>{health.message}</Text>}
        <Text style={styles.hint}>{API_URL}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>@langx/shared</Text>
        <Text style={styles.value}>{LANGUAGES.length} languages</Text>
        <Text style={styles.value}>{MINIMUM_AGE}+ only</Text>
        <Text style={styles.value}>free: {PLAN_LIMITS.free.initiationsPer24h} new chats / 24h</Text>
      </View>

      <Button label="Sign out" onPress={onSignOut} loading={signingOut} variant="secondary" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  title: { fontSize: 32, fontWeight: '700' },
  subtitle: { fontSize: 16, opacity: 0.6 },
  card: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
    minWidth: 260,
    padding: 16,
  },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 1, opacity: 0.5 },
  value: { fontSize: 15 },
  ok: { fontSize: 15, fontWeight: '600' },
  error: { fontSize: 13 },
  hint: { fontSize: 11, opacity: 0.4 },
})
