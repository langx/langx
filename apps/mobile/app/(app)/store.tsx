import { TOKEN_RULES } from '@langx/shared'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { useState } from 'react'
import { useMe, usePurchase, useTokenHistory, useTokens, useWallet } from '../../src/api/queries'
import { StoreRow } from '../../src/components/store/StoreRow'
import { ProgressBar } from '../../src/components/ui/ProgressBar'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { goBackTo } from '../../src/lib/navigation'
import { buildStoreOffers } from '../../src/lib/storeOffers'
import { buildTokenHistory } from '../../src/lib/tokenHistory'
import { dayLabel } from '../../src/lib/messageGroups'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { useLocale, useT } from '../../src/i18n'

/**
 * The token screen, reached by tapping the balance on the profile.
 *
 * A route rather than a sheet: the app has no modal routes and adding one
 * would mean a gesture-handler dependency that does not resolve from this
 * package, for a surface that cannot be linked to or backed out of.
 */
export default function StoreScreen() {
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()

  const me = useMe()
  const xp = useTokens()
  const wallet = useWallet()
  const purchase = usePurchase()
  const history = useTokenHistory()
  const { locale } = useLocale()
  const [openDay, setOpenDay] = useState<string | null>(null)

  if (me.isPending || !me.data) {
    return (
      <Screen>
        <ActivityIndicator style={styles.loading} />
      </Screen>
    )
  }

  const restored = me.data.restoredFromV1
  const offers = buildStoreOffers({
    t,
    balance: wallet.data?.balance ?? 0,
    owned: wallet.data?.owned ?? [],
    streakFreezes: wallet.data?.streakFreezes ?? 0,
    restorableStreak: restored && !restored.streakRestoredAt ? restored.frozenStreak : 0,
  })

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

  function refresh(): void {
    void Promise.all([me.refetch(), xp.refetch(), wallet.refetch(), history.refetch()])
  }

  return (
    <Screen scroll onRefresh={refresh} refreshing={wallet.isFetching}>
      <ScreenHeader title={t('store.title')} onBack={() => goBackTo('/(app)/me')} />

      <View style={styles.section}>
        <Text style={styles.kicker}>{t('store.balance')}</Text>
        <Text style={styles.balanceValue}>{wallet.data?.balance ?? 0}</Text>
        <Text style={styles.body}>{t('store.intro')}</Text>
      </View>

      {pool ? (
        <View style={styles.section}>
          <View style={styles.poolHead}>
            <Text style={styles.poolTitle}>{t('store.todaysPool')}</Text>
            <Text style={styles.meta}>{t('store.activeToday', { count: pool.activeToday })}</Text>
          </View>
          {lastPayout ? (
            <>
              <View style={styles.shareRow}>
                <Text style={styles.shareValue}>
                  {t('store.shareAmount', { count: lastPayout.amount })}
                </Text>
                <Text style={styles.meta}>
                  {t('store.shareFor', { day: dayLabel(lastPayout.day, { t, locale }) })}
                </Text>
              </View>
              <ProgressBar
                accessibilityLabel={t('store.todaysPool')}
                color={colors.success}
                value={shareCap > 0 ? lastPayout.amount / shareCap : 0}
              />
            </>
          ) : (
            <Text style={styles.meta}>{t('store.noShareYet')}</Text>
          )}
          <Text style={styles.meta}>{t('store.poolCap', { cap: shareCap })}</Text>
          <Text style={styles.meta}>
            {t('store.poolPaidAt', { hour: TOKEN_RULES.pool.payoutHourUtc })}
          </Text>
        </View>
      ) : null}

      <View style={styles.offers}>
        {offers.map((offer, index) => (
          <StoreRow
            key={offer.id}
            offer={offer}
            pending={purchase.isPending}
            last={index === offers.length - 1}
            onBuy={(id) => purchase.mutate(id)}
          />
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.poolTitle}>{t('store.history')}</Text>
        {historyRows.length === 0 ? (
          <Text style={styles.meta}>{t('store.historyEmpty')}</Text>
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
                    {t('store.shareAmount', { count: row.earned })}
                  </Text>
                </View>
                {row.spent > 0 ? (
                  <Text style={styles.meta}>{t('store.historySpent', { count: row.spent })}</Text>
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
            <Text style={styles.historyMoreText}>{t('store.historyMore')}</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.hint}>{t('store.disclaimer')}</Text>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  loading: { marginTop: spacing.xxl },
  section: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: spacing.sm + 2,
    paddingBottom: spacing.lg + 6,
    paddingTop: spacing.lg,
  },
  kicker: { color: colors.textFaint, fontSize: 13, fontWeight: '600' },
  balanceValue: { ...font.title, color: colors.text, fontSize: 56, lineHeight: 60 },
  body: { ...font.body, color: colors.textMuted, lineHeight: 23 },
  poolHead: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  poolTitle: { ...font.heading, color: colors.text, fontSize: 16 },
  shareRow: { alignItems: 'baseline', flexDirection: 'row', gap: spacing.sm + 1 },
  shareValue: { ...font.heading, color: colors.success, fontSize: 24 },
  meta: { ...font.label, color: colors.textMuted, fontWeight: '400', lineHeight: 19 },
  historyRow: { gap: 2, paddingVertical: spacing.sm },
  historyHead: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyDay: { ...font.label, color: colors.text },
  historyEarned: { ...font.label, color: colors.success },
  historyMore: { paddingTop: spacing.sm },
  historyMoreText: { ...font.label, color: colors.textMuted },
  offers: {},
  hint: {
    ...font.caption,
    color: colors.textFaint,
    fontSize: 13,
    lineHeight: 21,
    marginBottom: spacing.xxl,
    marginTop: spacing.lg,
  },
}))
