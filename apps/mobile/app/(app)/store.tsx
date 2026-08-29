import { TOKEN_RULES } from '@langx/shared'
import { ActivityIndicator, Text, View } from 'react-native'
import { useMe, usePurchase, useTokens, useWallet } from '../../src/api/queries'
import { StoreRow } from '../../src/components/store/StoreRow'
import { Card } from '../../src/components/ui/Card'
import { ProgressBar } from '../../src/components/ui/ProgressBar'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { goBackTo } from '../../src/lib/navigation'
import { buildStoreOffers } from '../../src/lib/storeOffers'
import { makeStyles, useTheme } from '../../src/lib/theme'

/**
 * The token store, reached by tapping the balance on the profile.
 *
 * A route rather than a sheet: the app has no modal routes and adding one
 * would mean a gesture-handler dependency that does not resolve from this
 * package, for a surface that cannot be linked to or backed out of. A route
 * also has somewhere to put the sections this is going to grow.
 */
export default function StoreScreen() {
  const { colors } = useTheme()
  const styles = useStyles()

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

  const today = xp.data?.today
  const messageCap = TOKEN_RULES.caps.messagesPerDay

  function refresh(): void {
    void Promise.all([me.refetch(), xp.refetch(), wallet.refetch()])
  }

  return (
    <Screen scroll onRefresh={refresh} refreshing={wallet.isFetching}>
      <ScreenHeader title="Tokens" onBack={() => goBackTo('/(app)/me')} />

      <View style={styles.balance}>
        <Text style={styles.balanceLabel}>Balance</Text>
        <Text style={styles.balanceValue}>{wallet.data?.balance ?? 0}</Text>
        <Text style={styles.balanceBody}>
          Earned by messaging and by correcting other people. Teaching is weighted higher than
          talking.
        </Text>
      </View>

      {/*
        Today's counters, not a projected pool share. The design draws "+84 your
        share so far", and the server is explicit that a share is only known
        when the pool closes the day — so this shows the two numbers that are
        already true and the cap they run into.
      */}
      {today ? (
        <Card style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Today</Text>
            <Text style={styles.cardMeta}>
              {today.messages} messages · {today.corrections} corrections
            </Text>
          </View>
          <ProgressBar
            accessibilityLabel={`${today.messages} of ${messageCap} paying messages today`}
            color={colors.success}
            height={8}
            value={today.messages / messageCap}
          />
          <Text style={styles.cardMeta}>
            {messageCap} messages a day pay tokens, {TOKEN_RULES.caps.messagesPerPartnerPerDay} of
            them per person. Corrections are not capped.
          </Text>
        </Card>
      ) : null}

      <Card inset style={styles.offers}>
        {offers.map((offer, index) => (
          <StoreRow
            key={offer.id}
            offer={offer}
            pending={purchase.isPending}
            last={index === offers.length - 1}
            onBuy={(id) => purchase.mutate(id)}
          />
        ))}
      </Card>

      <Text style={styles.hint}>
        Tokens cannot be bought, traded, withdrawn, or used to unlock any Pro feature — only streak
        freezes and cosmetics. There is no chain, no wallet and no market.
      </Text>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  loading: { marginTop: spacing.xxl },
  balance: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    marginTop: spacing.sm,
    padding: spacing.xl,
  },
  balanceLabel: { ...font.label, color: colors.primaryTextMuted },
  balanceValue: { ...font.title, color: colors.primaryText, fontSize: 48, marginTop: 2 },
  balanceBody: {
    ...font.label,
    color: colors.primaryTextMuted,
    fontWeight: '400',
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  card: { gap: spacing.sm, marginTop: spacing.md, padding: spacing.lg },
  // No padding: the rows bring their own, and the card only has to clip them
  // to its radius so the dividers stop at the corner.
  offers: { marginTop: spacing.md },
  cardHead: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  cardTitle: { ...font.heading, color: colors.text, fontSize: 15 },
  cardMeta: { ...font.caption, color: colors.textMuted, lineHeight: 18 },
  hint: {
    ...font.caption,
    color: colors.textMuted,
    lineHeight: 19,
    marginBottom: spacing.xxl,
    marginTop: spacing.lg,
  },
}))
