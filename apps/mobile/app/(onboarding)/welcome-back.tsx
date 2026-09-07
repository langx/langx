import { TIER_NAMES, TOKEN_RULES } from '@langx/shared'
import Feather from '@expo/vector-icons/Feather'
import { useQueryClient } from '@tanstack/react-query'
import { Redirect, router } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { LoadFailed } from '../../src/components/LoadFailed'
import { api } from '../../src/api/client'
import { keys, useMe } from '../../src/api/queries'
import { NotificationPriming } from '../../src/components/NotificationPriming'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { useT } from '../../src/i18n'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

function Line({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Feather.glyphMap
  title: string
  body: string
}) {
  const { colors } = useTheme()
  const styles = useStyles()

  return (
    <View style={styles.line}>
      <View style={styles.lineIcon}>
        <Feather name={icon} size={22} color={colors.accent} />
      </View>
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
  useScreenInteractive()
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
    <Screen fluid>
      {/* The rows fill the height so the button sits at the bottom; a long restore scrolls. */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t('welcomeBack.title')}</Text>
        <Text style={styles.subtitle}>{t('welcomeBack.subtitle')}</Text>

        <View style={styles.lines}>
          <Line
            icon="user"
            title={t('welcomeBack.handleTitle', { handle })}
            body={t('welcomeBack.handleBody')}
          />

          {conversationsImported > 0 ? (
            <Line
              icon="message-square"
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
              icon="credit-card"
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
              icon="credit-card"
              title={t('welcomeBack.tokensBonus', { count: TOKEN_RULES.welcomeBackBonus })}
              body={t('welcomeBack.tokensBonusBody')}
            />
          )}

          {frozenStreak > 0 ? (
            <Line
              icon="zap"
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
              icon="award"
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
        />
      </ScrollView>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  scroll: { flex: 1 },
  content: { flexGrow: 1, gap: 18, paddingBottom: 28, paddingTop: spacing.xl },
  title: { ...font.title, color: colors.text, fontSize: 34, lineHeight: 39, marginTop: spacing.md },
  subtitle: { color: colors.textMuted, fontSize: 17, lineHeight: 26 },
  lines: { borderTopColor: colors.border, borderTopWidth: 1, flex: 1, marginTop: spacing.sm },
  line: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.lg,
    paddingVertical: 18,
  },
  lineIcon: {
    alignItems: 'center',
    backgroundColor: colors.accentBg,
    borderRadius: radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  lineText: { flex: 1, gap: 3 },
  lineTitle: { ...font.heading, color: colors.text, fontSize: 17 },
  lineBody: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
}))
