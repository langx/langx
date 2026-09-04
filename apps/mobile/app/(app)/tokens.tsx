import { router } from 'expo-router'
import { TOKEN_RULES } from '@langx/shared'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { useState } from 'react'
import { useTokenHistory, useTokens } from '../../src/api/queries'
import { ProgressBar } from '../../src/components/ui/ProgressBar'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { ListRow } from '../../src/components/ui/ListRow'
import { StatTile } from '../../src/components/ui/StatTile'
import { goBackTo } from '../../src/lib/navigation'
import { buildTokenHistory } from '../../src/lib/tokenHistory'
import { dayLabel } from '../../src/lib/messageGroups'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { useLocale, useT } from '../../src/i18n'
import { usePullToRefresh } from '../../src/hooks/usePullToRefresh'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

/**
 * Where the tokens came from: the totals, the pool, and the ledger a day at a
 * time.
 *
 * One level below the wallet, reached by pressing the balance. The two used to
 * be one screen, which meant the shop sat under a list that grows by a row a
 * day — so the thing you can act on was below the thing you can only read.
 */
export default function TokensScreen() {
  useScreenInteractive()
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()
  const { locale } = useLocale()

  const xp = useTokens()
  const history = useTokenHistory()
  const [openDay, setOpenDay] = useState<string | null>(null)

  const pool = xp.data?.pool

  /*
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
  const shareCap = TOKEN_RULES.pool.total * TOKEN_RULES.pool.maxShareOfPool
  const lastPayout = pool?.lastPayout ?? null

  const historyRows = buildTokenHistory({
    days: history.data?.pages.flatMap((page) => page.days) ?? [],
    t,
    locale,
  })

  // Above the early return, where hooks have to be.
  const pull = usePullToRefresh(() => Promise.all([xp.refetch(), history.refetch()]))

  if (xp.isPending) {
    return (
      <Screen>
        <ActivityIndicator style={styles.loading} />
      </Screen>
    )
  }

  return (
    <Screen scroll {...pull}>
      <ScreenHeader title={t('tokens.title')} onBack={() => goBackTo('/(app)/wallet')} />

      <View style={styles.tiles}>
        <StatTile label={t('tokens.thisWeek')} value={String(xp.data?.tokens.week ?? 0)} />
        <StatTile label={t('tokens.thisMonth')} value={String(xp.data?.tokens.month ?? 0)} />
        <StatTile label={t('tokens.allTime')} value={String(xp.data?.tokens.all ?? 0)} />
      </View>

      <Text style={styles.body}>{t('tokens.intro')}</Text>

      {/*
        This screen's whole job is answering "where do tokens come from". A way
        to earn a thousand of them that is not listed here is a way nobody
        finds.
      */}
      <ListRow
        title={t('tokens.inviteRow')}
        subtitle={t('invite.step2', { activation: String(TOKEN_RULES.referral.activation) })}
        onPress={() => router.push('/(app)/invite')}
      />

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
            <Text style={styles.meta}>{t('tokens.noShareYet')}</Text>
          )}
          <Text style={styles.meta}>{t('tokens.poolCap', { cap: shareCap })}</Text>
          <Text style={styles.meta}>
            {t('tokens.poolPaidAt', { hour: TOKEN_RULES.pool.payoutHourUtc })}
          </Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.poolTitle}>{t('tokens.history')}</Text>
        {historyRows.length === 0 ? (
          <Text style={styles.meta}>{t('tokens.historyEmpty')}</Text>
        ) : (
          historyRows.map((row) => {
            const open = openDay === row.day
            return (
              <Pressable
                key={row.day}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                // The day's total is the summary; the breakdown under it is
                // what answers "how much of that was the pool".
                onPress={() => setOpenDay(open ? null : row.day)}
                style={styles.historyRow}
              >
                <View style={styles.historyHead}>
                  <Text style={styles.historyDay}>{row.label}</Text>
                  <Text style={styles.historyEarned}>
                    {t('tokens.shareAmount', { count: row.earned })}
                  </Text>
                </View>
                {row.spent > 0 ? (
                  <Text style={styles.meta}>{t('tokens.historySpent', { count: row.spent })}</Text>
                ) : null}
                {open
                  ? row.entries.map((entry) => (
                      <View key={entry.kind} style={styles.historyHead}>
                        <Text style={styles.meta}>{entry.label}</Text>
                        <Text style={styles.meta}>{entry.amount}</Text>
                      </View>
                    ))
                  : null}
              </Pressable>
            )
          })
        )}
        {history.hasNextPage ? (
          <Pressable
            accessibilityRole="button"
            disabled={history.isFetchingNextPage}
            onPress={() => void history.fetchNextPage()}
            style={styles.historyMore}
          >
            <Text style={styles.historyMoreText}>{t('tokens.historyMore')}</Text>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  )
}
const useStyles = makeStyles(({ colors, font, spacing }) => ({
  loading: { marginTop: spacing.xxl },
  tiles: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingBottom: spacing.lg,
    paddingTop: spacing.lg,
  },
  body: { ...font.body, color: colors.textMuted, lineHeight: 23, marginTop: spacing.lg },
  section: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: spacing.sm + 2,
    paddingBottom: spacing.lg + 6,
    paddingTop: spacing.lg,
  },
  poolHead: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
  poolTitle: { ...font.heading, color: colors.text, fontSize: 16 },
  shareRow: { alignItems: 'baseline', flexDirection: 'row', gap: spacing.sm + 1 },
  shareValue: { ...font.heading, color: colors.success, fontSize: 24 },
  meta: { ...font.label, color: colors.textMuted, fontWeight: '400', lineHeight: 19 },
  historyRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingVertical: spacing.sm + 2,
  },
  historyHead: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
  historyDay: { ...font.label, color: colors.text },
  historyEarned: { ...font.label, color: colors.success },
  historyMore: { alignItems: 'center', paddingVertical: spacing.md },
  historyMoreText: { ...font.label, color: colors.accent },
}))
