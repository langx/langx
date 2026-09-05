import { COSMETICS } from '@langx/shared'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { router, type Href } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'
import { LoadFailed } from '../../../src/components/LoadFailed'
import { useMe, useWallet } from '../../../src/api/queries'
import { GiftCard } from '../../../src/components/store/GiftCard'
import { ListRow } from '../../../src/components/ui/ListRow'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { StatTile } from '../../../src/components/ui/StatTile'
import { goBackTo } from '../../../src/lib/navigation'
import { makeStyles, useTheme } from '../../../src/lib/theme'
import { useLocale, useT, type MessageKey } from '../../../src/i18n'
import { compactCount } from '../../../src/lib/format'
import { usePullToRefresh } from '../../../src/hooks/usePullToRefresh'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'

/**
 * The wallet, as categories.
 *
 * It used to be one scroll: the balance, a four-tab leaderboard, two tiles,
 * two pickers, the gift, the shop and a disclaimer — the shape Settings had
 * before it became categories, and with the same result, that the thing you
 * came for was under three things you did not. So this page is the shape
 * Settings has now: what you have at the top, the one free thing under it,
 * and a row per category, each opening its own page.
 *
 * The gift stays here rather than in the store because it is not for sale.
 * It is the one thing in the wallet that asks for nothing, and a card that
 * turns into a button once an hour is worth the space on the landing page.
 */
const SECTIONS: readonly { id: string; titleKey: MessageKey; bodyKey: MessageKey; route: Href }[] =
  [
    {
      id: 'history',
      titleKey: 'tokens.history',
      bodyKey: 'wallet.historyBody',
      route: '/(app)/wallet/history',
    },
    {
      id: 'leaderboard',
      titleKey: 'leaderboard.title',
      bodyKey: 'wallet.leaderboardBody',
      route: '/(app)/wallet/leaderboard',
    },
    {
      id: 'pool',
      titleKey: 'tokens.poolTitle',
      bodyKey: 'wallet.poolBody',
      route: '/(app)/wallet/pool',
    },
    {
      id: 'store',
      titleKey: 'wallet.storeTitle',
      bodyKey: 'wallet.storeBody',
      route: '/(app)/wallet/store',
    },
  ]

export default function WalletScreen() {
  useScreenInteractive()
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()
  const { locale } = useLocale()

  const me = useMe()
  const wallet = useWallet()
  // Above the early return, where hooks have to be; both behind one pull.
  const pull = usePullToRefresh(() => Promise.all([me.refetch(), wallet.refetch()]))

  /*
   * `!me.data` rather than `isPending`, and an error branch beside it.
   * `useMe` does not retry, so a refused request settles at once with nothing
   * — and `isPending || !me.data` stayed true forever, leaving this screen on
   * a spinner with no end and nothing to press. Data already in hand still
   * wins over a failed refetch, which is what checking it first says.
   */
  if (!me.data) {
    return (
      <Screen>
        {me.isError ? (
          <LoadFailed onRetry={() => void me.refetch()} />
        ) : (
          <ActivityIndicator style={styles.loading} />
        )}
      </Screen>
    )
  }

  const balance = wallet.data?.balance ?? 0
  const owned = wallet.data?.owned ?? []

  return (
    <Screen scroll {...pull}>
      <ScreenHeader title={t('wallet.title')} onBack={() => goBackTo('/(app)/(tabs)/me')} />

      {/*
        The balance is the way into the ledger, so it is pressable — and says
        so. A number that opens something without looking like it does is a
        number people never press.
      */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('wallet.balance')}: ${balance}`}
        onPress={() => router.push('/(app)/wallet/history')}
        style={({ pressed }) => [styles.section, pressed && styles.pressed]}
      >
        <Text style={styles.kicker}>{t('wallet.balance')}</Text>
        <Text style={styles.balanceValue}>{compactCount(balance, locale)}</Text>
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

      {wallet.data ? (
        <View style={styles.gift}>
          <GiftCard nextAt={wallet.data.gift.nextAt} onOpen={() => router.push('/(app)/gift')} />
        </View>
      ) : null}

      <View style={styles.tiles}>
        <StatTile
          label={t('wallet.streakFreezes')}
          value={String(wallet.data?.streakFreezes ?? 0)}
        />
        <StatTile label={t('wallet.itemsOwned')} value={`${owned.length}/${COSMETICS.length}`} />
      </View>

      <View style={styles.categories}>
        {SECTIONS.map((section, index) => (
          <ListRow
            key={section.id}
            title={t(section.titleKey)}
            subtitle={t(section.bodyKey)}
            last={index === SECTIONS.length - 1}
            onPress={() => router.push(section.route)}
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
  gift: { paddingTop: spacing.lg },
  tiles: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingBottom: spacing.lg,
    paddingTop: spacing.lg,
  },
  categories: { marginTop: spacing.sm },
  hint: {
    ...font.caption,
    color: colors.textFaint,
    fontSize: 13,
    lineHeight: 21,
    marginBottom: spacing.xxl,
    marginTop: spacing.lg,
  },
}))
