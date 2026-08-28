import { router } from 'expo-router'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useMe, usePurchase, useTokens, useWallet } from '../../src/api/queries'
import { StoreRow } from '../../src/components/store/StoreRow'
import { Screen } from '../../src/components/ui/Screen'
import { goBackTo } from '../../src/lib/navigation'
import { buildStoreOffers } from '../../src/lib/storeOffers'
import { colors, font, radius, spacing } from '../../src/lib/theme'

/**
 * The token store, reached by tapping the balance on the profile.
 *
 * A route rather than a sheet: the app has no modal routes and adding one
 * would mean a gesture-handler dependency that does not resolve from this
 * package, for a surface that cannot be linked to or backed out of. A route
 * also has somewhere to put the sections this is going to grow.
 */
export default function StoreScreen() {
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
    balance: wallet.data?.balance ?? 0,
    owned: wallet.data?.owned ?? [],
    streakFreezes: wallet.data?.streakFreezes ?? 0,
    restorableStreak: restored && !restored.streakRestoredAt ? restored.frozenStreak : 0,
  })

  function refresh(): void {
    void Promise.all([me.refetch(), xp.refetch(), wallet.refetch()])
  }

  return (
    <Screen scroll onRefresh={refresh} refreshing={wallet.isFetching}>
      <Pressable onPress={() => goBackTo('/(app)/me')} hitSlop={12} style={styles.backRow}>
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>
      <Text style={styles.title}>Token store</Text>

      <View style={styles.balance}>
        <Text style={styles.balanceLabel}>Balance</Text>
        <Text style={styles.balanceValue}>{wallet.data?.balance ?? 0}</Text>
      </View>

      <Text style={styles.hint}>
        Tokens cannot be bought, traded, withdrawn, or used to unlock any Pro feature — only streak
        freezes and cosmetics.
      </Text>

      {offers.map((offer) => (
        <StoreRow
          key={offer.id}
          offer={offer}
          pending={purchase.isPending}
          onBuy={(id) => purchase.mutate(id)}
        />
      ))}
    </Screen>
  )
}

const styles = StyleSheet.create({
  back: { ...font.body, color: colors.textMuted },
  backRow: { paddingTop: spacing.md },
  balance: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  balanceLabel: { ...font.label, color: colors.textMuted },
  balanceValue: { ...font.title, color: colors.accent },
  hint: {
    ...font.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
    marginTop: spacing.xl,
  },
  loading: { marginTop: spacing.xxl },
  title: { ...font.title, color: colors.text, marginTop: spacing.xs },
})
