import { LANGUAGES, MINIMUM_AGE, PLAN_LIMITS } from '@langx/shared'
import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000'

type HealthState =
  { kind: 'loading' } | { kind: 'ok'; db: string } | { kind: 'error'; message: string }

/**
 * Faz 0 smoke screen. It exists to prove three things at once on iOS, Android
 * and web: the app boots, `@langx/shared` resolves as source through the
 * monorepo, and the client can reach the API. Replaced by real routing in
 * Faz 1.
 */
export default function Index() {
  const [health, setHealth] = useState<HealthState>({ kind: 'loading' })

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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>LangX v2</Text>
      <Text style={styles.subtitle}>Practice, Learn, Succeed!</Text>

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
