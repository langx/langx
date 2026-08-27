import { TOKEN_RULES } from '@langx/shared'
import { useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { api } from '../../src/api/client'
import { keys, useMe } from '../../src/api/queries'
import { NotificationPriming } from '../../src/components/NotificationPriming'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { days } from '../../src/lib/format'
import { colors, font, radius, spacing } from '../../src/lib/theme'

function Line({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineIcon}>{icon}</Text>
      <View style={styles.lineText}>
        <Text style={styles.lineTitle}>{title}</Text>
        <Text style={styles.lineBody}>{body}</Text>
      </View>
    </View>
  )
}

/**
 * The one screen a returning v1 user sees, and the only "onboarding" they get:
 * a full restore skips the wizard entirely, so without this they would land on
 * a discovery feed with a handle, a streak record and a token balance they were
 * never told about.
 *
 * It counts back what actually returned rather than saying "welcome back" and
 * leaving them to find it, because the things that came back — a handle someone
 * chose years ago, a conversation with a person they had stopped talking to —
 * are the whole argument for having migrated anything at all.
 */
export default function WelcomeBackScreen() {
  const me = useMe()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)

  const restored = me.data?.restoredFromV1

  async function acknowledge(): Promise<void> {
    setBusy(true)
    try {
      await api.post('/me/welcome-back/ack', {})
      // Refetch before leaving: the gate in `app/index.tsx` reads the same
      // profile, and a stale cache would bounce the user straight back here.
      await queryClient.invalidateQueries({ queryKey: keys.me })
    } catch {
      // Not worth blocking on. The worst case is seeing this screen once more,
      // and refusing to move them on would be a far worse answer than that.
    } finally {
      setBusy(false)
      router.replace('/(app)/discover')
    }
  }

  if (me.isPending || !restored) {
    return (
      <Screen>
        <ActivityIndicator />
      </Screen>
    )
  }

  const handle = me.data?.handle ?? ''
  const { tokensCredited, conversationsImported, frozenStreak } = restored

  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Text style={styles.emoji}>👋</Text>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Here is what came with you.</Text>
      </View>

      <View style={styles.card}>
        <Line
          icon="@"
          title={`@${handle}`}
          body="Your username is yours again — nobody else could claim it."
        />

        {conversationsImported > 0 ? (
          <Line
            icon="💬"
            title={
              conversationsImported === 1
                ? '1 conversation restored'
                : `${conversationsImported} conversations restored`
            }
            body="Threads where the other person came back too. The rest arrive if and when they do."
          />
        ) : null}

        {/*
          More than half of all v1 balances convert to zero — the median was 20
          tokens and the divisor is 100 — so "your tokens are back" would be a
          lie told to most of the people reading this. The bonus leads instead,
          and the conversion is only mentioned when there is one.
        */}
        {tokensCredited > 0 ? (
          <Line
            icon="🪙"
            title={`${tokensCredited + TOKEN_RULES.welcomeBackBonus} tokens`}
            body={`${tokensCredited} carried over from your old balance, plus ${TOKEN_RULES.welcomeBackBonus} for coming back.`}
          />
        ) : (
          <Line
            icon="🪙"
            title={`${TOKEN_RULES.welcomeBackBonus} tokens`}
            body="A welcome-back bonus to start with. Earn more by talking and by correcting."
          />
        )}

        {frozenStreak > 0 ? (
          <Line
            icon="🔥"
            title={`${days(frozenStreak)} best streak`}
            body="Kept as your record. Your live streak starts fresh from today."
          />
        ) : null}
      </View>

      {/*
        A returning user never sees `done.tsx`, so the notification prompt has
        to have a second home — this is the only screen they pass through.
      */}
      <NotificationPriming />

      <Button
        label={busy ? 'One moment…' : 'Start using LangX'}
        onPress={() => void acknowledge()}
        loading={busy}
        style={styles.action}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: spacing.xl },
  emoji: { fontSize: 56, marginBottom: spacing.md },
  title: { ...font.title, color: colors.text },
  subtitle: { ...font.body, color: colors.textMuted, marginTop: spacing.xs },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  line: { flexDirection: 'row', gap: spacing.md },
  lineIcon: { fontSize: 20, width: 28 },
  lineText: { flex: 1 },
  lineTitle: { ...font.body, color: colors.text, fontWeight: '600' },
  lineBody: { ...font.caption, color: colors.textMuted, marginTop: 2 },
  action: { marginTop: spacing.xl },
})
