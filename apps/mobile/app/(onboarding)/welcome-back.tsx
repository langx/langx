import { TOKEN_RULES } from '@langx/shared'
import { useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { api } from '../../src/api/client'
import { keys, useMe } from '../../src/api/queries'
import { NotificationPriming } from '../../src/components/NotificationPriming'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { makeStyles } from '../../src/lib/theme'
import { useT } from '../../src/i18n'

function Line({ icon, title, body }: { icon: string; title: string; body: string }) {
  const styles = useStyles()

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
  const styles = useStyles()
  const t = useT()

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
  const { tokensCredited, conversationsImported, frozenStreak, lifetimeGranted } = restored

  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Text style={styles.emoji}>👋</Text>
        <Text style={styles.title}>{t('welcomeBack.title')}</Text>
        <Text style={styles.subtitle}>{t('welcomeBack.subtitle')}</Text>
      </View>

      <View style={styles.card}>
        <Line
          icon="@"
          title={t('welcomeBack.handleTitle', { handle })}
          body={t('welcomeBack.handleBody')}
        />

        {conversationsImported > 0 ? (
          <Line
            icon="💬"
            title={t('welcomeBack.conversations', { count: conversationsImported })}
            body={t('welcomeBack.conversationsBody')}
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
            title={t('welcomeBack.tokensCarried', {
              count: tokensCredited + TOKEN_RULES.welcomeBackBonus,
            })}
            body={t('welcomeBack.tokensCarriedBody', {
              carried: tokensCredited,
              bonus: TOKEN_RULES.welcomeBackBonus,
            })}
          />
        ) : (
          <Line
            icon="🪙"
            title={t('welcomeBack.tokensBonus', { count: TOKEN_RULES.welcomeBackBonus })}
            body={t('welcomeBack.tokensBonusBody')}
          />
        )}

        {frozenStreak > 0 ? (
          <Line
            icon="🔥"
            title={t('welcomeBack.streak', { days: t('format.days', { count: frozenStreak }) })}
            body={t('welcomeBack.streakBody')}
          />
        ) : null}

        {/*
          Roughly the top one percent of v1 balances, so most people never see
          this line — which is the point of putting it last and of saying it
          plainly. A gift nobody is told about is indistinguishable from no
          gift, and this screen is the only place the recipient learns of it.
        */}
        {lifetimeGranted ? (
          <Line
            icon="✨"
            title={t(
              lifetimeGranted === 'pro_plus'
                ? 'welcomeBack.proPlusForLife'
                : 'welcomeBack.proForLife',
            )}
            body={t('welcomeBack.proBody')}
          />
        ) : null}
      </View>

      {/*
        A returning user never sees `done.tsx`, so the notification prompt has
        to have a second home — this is the only screen they pass through.
      */}
      <NotificationPriming />

      <Button
        label={busy ? t('common.oneMoment') : t('welcomeBack.start')}
        onPress={() => void acknowledge()}
        loading={busy}
        style={styles.action}
      />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
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
}))
