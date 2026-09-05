import { TOKEN_RULES, firstPayoutAt } from '@langx/shared'
import { ActivityIndicator, Text, View } from 'react-native'
import { useMe, useTokens } from '../../../src/api/queries'
import { ProgressBar } from '../../../src/components/ui/ProgressBar'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { goBackTo } from '../../../src/lib/navigation'
import { dayLabel } from '../../../src/lib/messageGroups'
import { makeStyles, useTheme } from '../../../src/lib/theme'
import { useLocale, useT } from '../../../src/i18n'
import { usePullToRefresh } from '../../../src/hooks/usePullToRefresh'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'

/**
 * The daily pool: the share it last paid you, and how busy today is.
 *
 * The share the pool actually paid, not a projection of tonight's.
 *
 * The obvious card draws a live "+84 your share so far" from your score over
 * everyone's. It reads well and it is a lie: the denominator moves all day,
 * and the payout applies an eligibility the projection cannot see — an
 * account inside `accountAgeRampUpHours` would watch a share climb until
 * midnight and be paid nothing. So the big number is one that already
 * happened, and the only forward-looking thing on the card is how busy today
 * is, which is a fact rather than a promise.
 */
export default function PoolScreen() {
  useScreenInteractive()
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()
  const { locale } = useLocale()

  const xp = useTokens()
  const me = useMe()
  const pull = usePullToRefresh(() => xp.refetch())

  const pool = xp.data?.pool
  const shareCap = TOKEN_RULES.pool.total * TOKEN_RULES.pool.maxShareOfPool
  const lastPayout = pool?.lastPayout ?? null
  const today = xp.data?.today

  /*
   * When the next share can land, for somebody who has never had one.
   *
   * Not a projected amount — the note on `tokenSummarySchema.pool` explains
   * why there is deliberately no such number — but a *time*, which is a fact
   * and the one thing the empty state was missing. "No share yet" on its own
   * is what a broken pool would say too, and the two rules that make it the
   * right answer (a day is settled the morning after it closes; an account
   * inside the ramp-up earns nothing for the day it signed up on) are not
   * guessable from the screen.
   */
  const createdAt = me.data?.createdAt
  const nextPayoutAt = createdAt ? firstPayoutAt(new Date(createdAt), new Date()) : null

  if (xp.isPending) {
    return (
      <Screen>
        <ActivityIndicator style={styles.loading} />
      </Screen>
    )
  }

  return (
    <Screen scroll {...pull}>
      <ScreenHeader title={t('tokens.poolTitle')} onBack={() => goBackTo('/(app)/wallet')} />

      <Text style={styles.body}>{t('tokens.intro')}</Text>

      {pool ? (
        <View style={styles.section}>
          <View style={styles.poolHead}>
            <Text style={styles.poolTitle}>{t('tokens.poolTitle')}</Text>
            <Text style={styles.meta}>{t('tokens.activeToday', { count: pool.activeToday })}</Text>
          </View>
          {lastPayout ? (
            <>
              <View style={styles.shareRow}>
                <Text style={styles.shareValue}>
                  {t('tokens.shareAmount', { count: lastPayout.amount })}
                </Text>
                <Text style={styles.meta}>
                  {t('tokens.shareFor', { day: dayLabel(lastPayout.day, { t, locale }) })}
                </Text>
              </View>
              <ProgressBar
                accessibilityLabel={t('tokens.poolTitle')}
                color={colors.success}
                value={shareCap > 0 ? lastPayout.amount / shareCap : 0}
              />
            </>
          ) : (
            <Text style={styles.meta}>
              {nextPayoutAt
                ? t('tokens.firstShareAt', {
                    when: nextPayoutAt.toLocaleString(locale, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }),
                  })
                : t('tokens.noShareYet')}
            </Text>
          )}
          {/*
            Today's own numbers, so the card says something true about the
            day you are in rather than only about a day that has closed. This
            is what makes "no share yet" legible: the counters move while you
            talk, which is the evidence the pool is reading you at all.
          */}
          {today ? (
            <Text style={styles.meta}>
              {t('tokens.todayActivity', {
                score: Math.round(today.activityScore),
                messages: today.messages,
                corrections: today.corrections,
                partners: today.distinctPartners,
              })}
            </Text>
          ) : null}
          <Text style={styles.meta}>{t('tokens.poolCap', { cap: shareCap })}</Text>
          <Text style={styles.meta}>
            {t('tokens.poolPaidAt', { hour: TOKEN_RULES.pool.payoutHourUtc })}
          </Text>
        </View>
      ) : null}
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  loading: { marginTop: spacing.xxl },
  body: { ...font.body, color: colors.textMuted, lineHeight: 23, marginTop: spacing.lg },
  section: {
    gap: spacing.sm + 2,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.lg,
  },
  poolHead: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
  poolTitle: { ...font.heading, color: colors.text, fontSize: 16 },
  shareRow: { alignItems: 'baseline', flexDirection: 'row', gap: spacing.sm + 1 },
  shareValue: { ...font.heading, color: colors.success, fontSize: 24 },
  meta: { ...font.label, color: colors.textMuted, fontWeight: '400', lineHeight: 19 },
}))
