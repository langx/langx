import { COSMETICS } from '@langx/shared'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { router } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'
import { useMe, usePurchase, useWallet } from '../../src/api/queries'
import { StoreRow } from '../../src/components/store/StoreRow'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { StatTile } from '../../src/components/ui/StatTile'
import { goBackTo } from '../../src/lib/navigation'
import { buildStoreOffers } from '../../src/lib/storeOffers'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { useT } from '../../src/i18n'

/**
 * The wallet: what you have, and what it buys.
 *
 * Split from the screen that used to be all of it. That one answered two
 * questions at once — "what can I spend" and "where did this come from" — and
 * the second is a ledger, which grows without bound and pushed the shop below
 * a scroll nobody reached. The balance is the seam: it is the answer to the
 * first question and the way into the second, so tapping it opens `/tokens`.
 *
 * A route rather than a sheet: the app has no modal routes and adding one
 * would mean a gesture-handler dependency that does not resolve from this
 * package, for a surface that cannot be linked to or backed out of.
 */
export default function WalletScreen() {
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()

  const me = useMe()
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
  const balance = wallet.data?.balance ?? 0
  const owned = wallet.data?.owned ?? []
  const offers = buildStoreOffers({
    t,
    balance,
    owned,
    streakFreezes: wallet.data?.streakFreezes ?? 0,
    restorableStreak: restored && !restored.streakRestoredAt ? restored.frozenStreak : 0,
  })

  function refresh(): void {
    void Promise.all([me.refetch(), wallet.refetch()])
  }

  return (
    <Screen scroll onRefresh={refresh} refreshing={wallet.isFetching}>
      <ScreenHeader title={t('wallet.title')} onBack={() => goBackTo('/(app)/me')} />

      {/*
        The balance is the way into the ledger, so it is pressable — and says
        so. A number that opens something without looking like it does is a
        number people never press.
      */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('wallet.balance')}: ${balance}`}
        onPress={() => router.push('/(app)/tokens')}
        style={({ pressed }) => [styles.section, pressed && styles.pressed]}
      >
        <Text style={styles.kicker}>{t('wallet.balance')}</Text>
        <Text style={styles.balanceValue}>{balance}</Text>
        <View style={styles.balanceHint}>
          <Text style={styles.body}>
            {t('wallet.earnedSpent', {
              earned: wallet.data?.earned ?? 0,
              spent: wallet.data?.spent ?? 0,
            })}
          </Text>
          <Feather name="chevron-right" size={18} color={colors.textFaint} />
        </View>
      </Pressable>

      <View style={styles.tiles}>
        <StatTile
          label={t('wallet.streakFreezes')}
          value={String(wallet.data?.streakFreezes ?? 0)}
        />
        <StatTile label={t('wallet.itemsOwned')} value={`${owned.length}/${COSMETICS.length}`} />
      </View>

      <Text style={styles.sectionTitle}>{t('wallet.storeTitle')}</Text>
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

      <Text style={styles.hint}>{t('wallet.disclaimer')}</Text>
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
  pressed: { opacity: 0.7 },
  kicker: { color: colors.textFaint, fontSize: 13, fontWeight: '600' },
  balanceValue: { ...font.title, color: colors.text, fontSize: 56, lineHeight: 60 },
  balanceHint: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  body: { ...font.body, color: colors.textMuted, lineHeight: 23 },
  tiles: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingBottom: spacing.lg,
    paddingTop: spacing.lg,
  },
  sectionTitle: { ...font.heading, color: colors.text, fontSize: 16, marginTop: spacing.lg },
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
