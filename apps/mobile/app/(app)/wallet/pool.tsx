import { TOKEN_RULES, firstPayoutAt } from '@langx/shared'
import { Text, View } from 'react-native'
import { useMe, useTokens } from '../../../src/api/queries'
import { Screen } from '../../../src/components/ui/Screen'
import { Skeleton } from '../../../src/components/ui/Skeleton'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { goBackTo } from '../../../src/lib/navigation'
import { dayLabel } from '../../../src/lib/messageGroups'
import { makeStyles } from '../../../src/lib/theme'
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
 * happened, and the only forward-looking thing on the page is how busy today
 * is, which is a fact rather than a promise. For the same reason there is no
 * bar under today's score: the score is an uncapped weighted sum and the cap
 * is on the token share, so a fraction of one over the other would draw a
 * progress that does not exist.
 */
export default function PoolScreen() {
  useScreenInteractive()
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
        <ScreenHeader title={t('tokens.poolTitle')} onBack={() => goBackTo('/(app)/wallet')} />
        <View style={styles.loading}>
          <Skeleton width={132} height={12} />
          <Skeleton width={176} height={40} />
          <Skeleton width="62%" height={14} />
          <Skeleton height={88} />
          <Skeleton height={88} />
        </View>
      </Screen>
    )
  }

  return (
    <Screen scroll {...pull}>
      <ScreenHeader title={t('tokens.poolTitle')} onBack={() => goBackTo('/(app)/wallet')} />

      {pool ? (
        <View style={styles.share}>
          {lastPayout ? (
            <>
              <Text style={styles.kicker}>
                {t('tokens.shareForDay', { day: dayLabel(lastPayout.day, { t, locale }) })}
              </Text>
              <Text style={styles.shareValue}>
                {t('tokens.shareAmount', { count: lastPayout.amount })}
              </Text>
              {/* Who the share was split with; absent from an API that does not say. */}
              {lastPayout.participants !== undefined ? (
                <Text style={styles.meta}>
                  {t('tokens.poolParticipants', {
                    count: lastPayout.participants,
                    n: lastPayout.participants.toLocaleString(locale),
                  })}
                </Text>
              ) : null}
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
        </View>
      ) : null}

      {/*
        Today's own numbers, so the page says something true about the day you
        are in rather than only about a day that has closed. This is what makes
        "no share yet" legible: the counters move while you talk, which is the
        evidence the pool is reading you at all.
      */}
      {today ? (
        <View style={styles.today}>
          <View style={styles.todayHead}>
            <Text style={styles.todayTitle}>{t('tokens.todaySoFar')}</Text>
            <Text style={styles.meta}>
              {t('tokens.activityScore', { count: Math.round(today.activityScore) })}
            </Text>
          </View>
          <Text style={styles.body}>
            {t('tokens.todayBreakdown', {
              messages: today.messages,
              corrections: today.corrections,
              partners: today.distinctPartners,
            })}{' '}
            {t('tokens.poolCap', { cap: shareCap })}
          </Text>
        </View>
      ) : null}

      <View style={styles.how}>
        <Text style={styles.howTitle}>{t('invite.howTitle')}</Text>
        <Text style={styles.paragraph}>
          {t('tokens.poolPaidAt', { hour: TOKEN_RULES.pool.payoutHourUtc })}
        </Text>
        <Text style={styles.paragraph}>{t('tokens.intro')}</Text>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  loading: { gap: spacing.lg },
  share: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: 6,
    paddingBottom: 20,
    paddingTop: spacing.lg,
  },
  kicker: { color: colors.textFaint, fontSize: 13, fontWeight: '600' },
  // Not set solid, like the wallet's balance: Nunito's ascender is taller than
  // the em box, so a line height equal to the size overlapped the kicker.
  shareValue: { ...font.heading, color: colors.success, fontSize: 48, lineHeight: 56 },
  meta: { color: colors.textMuted, fontSize: 14 },
  today: { gap: 10, marginTop: 18 },
  todayHead: { flexDirection: 'row', justifyContent: 'space-between' },
  todayTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  body: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  how: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: 10,
    marginTop: 18,
    paddingTop: 18,
  },
  howTitle: { ...font.heading, color: colors.text, fontSize: 17 },
  paragraph: { color: colors.textMuted, fontSize: 15, lineHeight: 23 },
}))
