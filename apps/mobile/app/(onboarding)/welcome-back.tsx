import { TIER_NAMES, TOKEN_RULES } from '@langx/shared'
import { useQueryClient } from '@tanstack/react-query'
import { Redirect, router } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { LoadFailed } from '../../src/components/LoadFailed'
import { api } from '../../src/api/client'
import { keys, useMe } from '../../src/api/queries'
import { NotificationPriming } from '../../src/components/NotificationPriming'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { makeStyles } from '../../src/lib/theme'
import { useT } from '../../src/i18n'

function Line({
  icon,
  title,
  body,
  accent = false,
  first = false,
}: {
  icon: string
  title: string
  body: string
  /** Draws the glyph in the display face and blue — the "@" of the handle row. */
  accent?: boolean
  /** The divider sits *above* each row, so the first row suppresses it. */
  first?: boolean
}) {
  const styles = useStyles()

  return (
    <View style={[styles.line, first && styles.lineFirst]}>
      <Text style={[styles.lineIcon, accent && styles.lineIconAccent]}>{icon}</Text>
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
      router.replace('/(app)/(tabs)/discover')
    }
  }

  /*
   * Split from `!restored`, which used to be the same condition. `useMe` does
   * not retry, so a refused request left this on a spinner with no end; and a
   * profile that arrived with nothing to restore did too, forever, on a screen
   * whose whole content is the restore.
   */
  if (!me.data) {
    return (
      <Screen>
        {me.isError ? <LoadFailed onRetry={() => void me.refetch()} /> : <ActivityIndicator />}
      </Screen>
    )
  }

  // Only the gate sends people here, and only with a restore record. Reaching
  // it any other way — a deep link, or a refetch landing after the
  // acknowledgement — belongs in the app rather than on a blank version of it.
  if (!restored) return <Redirect href="/(app)/(tabs)/discover" />

  const handle = me.data?.handle ?? ''
  const { tokensCredited, conversationsImported, frozenStreak, lifetimeGranted } = restored

  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Text style={styles.emoji}>👋</Text>
        <Text style={styles.title}>{t('welcomeBack.title')}</Text>
        <Text style={styles.subtitle}>{t('welcomeBack.subtitle')}</Text>
      </View>

      <View>
        <Line
          icon="@"
          accent
          first
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
            title={t('welcomeBack.tierForLife', { plan: TIER_NAMES[lifetimeGranted] })}
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
        label={busy ? t('common.oneMoment') : t('welcomeBack.startExploring')}
        onPress={() => void acknowledge()}
        loading={busy}
        style={styles.action}
      />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  hero: { alignItems: 'center', paddingBottom: spacing.md, paddingTop: spacing.xxl },
  emoji: { fontSize: 48, lineHeight: 54 },
  title: { ...font.title, color: colors.text, fontSize: 28, marginTop: spacing.md + 2 },
  subtitle: {
    ...font.body,
    color: colors.textMuted,
    lineHeight: 23,
    marginTop: 6,
    maxWidth: 260,
    textAlign: 'center',
  },
  line: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.md + 2,
    paddingVertical: spacing.lg + 2,
  },
  lineFirst: { borderTopWidth: 0 },
  lineIcon: { fontSize: 18, width: 28 },
  lineIconAccent: { ...font.heading, color: colors.accent, fontSize: 18 },
  lineText: { flex: 1 },
  lineTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  lineBody: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 2 },
  action: { marginTop: spacing.xl },
}))
