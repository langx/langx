import { TOKEN_RULES, poolShare } from '@langx/shared'
import { ActivityIndicator, Text, View } from 'react-native'
import { useMe, usePurchase, useTokens, useWallet } from '../../src/api/queries'
import { StoreRow } from '../../src/components/store/StoreRow'
import { ProgressBar } from '../../src/components/ui/ProgressBar'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { goBackTo } from '../../src/lib/navigation'
import { buildStoreOffers } from '../../src/lib/storeOffers'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { useT } from '../../src/i18n'

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

  const today = xp.data?.today
  const pool = xp.data?.pool

  /**
   * Provisional, by the same arithmetic the day-close cron will run —
   * `poolShare` is shared for exactly this reason. The cap (5% of the pool)
   * is what the little bar fills toward, because it is the only fixed point
   * in a number that moves with everyone else's day.
   */
  const shareCap = TOKEN_RULES.pool.total * TOKEN_RULES.pool.maxShareOfPool
  const share = today && pool ? poolShare(today.activityScore, pool.totalScore) : 0

  function refresh(): void {
    void Promise.all([me.refetch(), xp.refetch(), wallet.refetch()])
  }

  return (
    <Screen scroll onRefresh={refresh} refreshing={wallet.isFetching}>
      <ScreenHeader title={t('store.title')} onBack={() => goBackTo('/(app)/me')} />

      <View style={styles.section}>
        <Text style={styles.kicker}>{t('store.balance')}</Text>
        <Text style={styles.balanceValue}>{wallet.data?.balance ?? 0}</Text>
        <Text style={styles.body}>{t('store.intro')}</Text>
      </View>

      {today && pool ? (
        <View style={styles.section}>
          <View style={styles.poolHead}>
            <Text style={styles.poolTitle}>{t('store.todaysPool')}</Text>
            <Text style={styles.meta}>{t('store.activeToday', { count: pool.activeToday })}</Text>
          </View>
          <View style={styles.shareRow}>
            <Text style={styles.shareValue}>{t('store.shareAmount', { count: share })}</Text>
            <Text style={styles.meta}>{t('store.shareSoFar')}</Text>
          </View>
          <ProgressBar
            accessibilityLabel={t('store.todaysPool')}
            color={colors.success}
            value={shareCap > 0 ? share / shareCap : 0}
          />
          <Text style={styles.meta}>{t('store.poolCap', { cap: shareCap })}</Text>
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
