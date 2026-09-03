import { COSMETICS, shiftDayKey, TOKEN_RULES, type PeriodType } from '@langx/shared'
import { useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { router } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'
import { LoadFailed } from '../../src/components/LoadFailed'
import {
  useActivity,
  useLeaderboard,
  useMe,
  usePurchase,
  useRepairDay,
  useTokens,
  useUpdateProfile,
  useWallet,
} from '../../src/api/queries'
import { EquipPicker } from '../../src/components/store/EquipPicker'
import { StoreRow } from '../../src/components/store/StoreRow'
import { LeaderboardSection } from '../../src/components/LeaderboardSection'
import type { StoreOffer } from '../../src/lib/storeOffers'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { StatTile } from '../../src/components/ui/StatTile'
import { showAlert } from '../../src/lib/alert'
import { goBackTo } from '../../src/lib/navigation'
import { confirmAndRepair } from '../../src/lib/repairFlow'
import { showToast } from '../../src/lib/toast'
import { buildStoreOffers } from '../../src/lib/storeOffers'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { periodLabel, useLocale, useT } from '../../src/i18n'
import { leaderboardShareText } from '../../src/lib/shareText'

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
/** The four tabs, in the order the board has always drawn them. */
const PERIOD_TABS: readonly PeriodType[] = ['week', 'month', 'year', 'all']

export default function WalletScreen() {
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()
  const { locale } = useLocale()

  const me = useMe()
  const wallet = useWallet()
  const [period, setPeriod] = useState<PeriodType>('week')
  const board = useLeaderboard(period)
  /*
   * The window a repair can still reach, so the store can offer the newest day
   * inside it. Same query the heatmap on `/me` already runs, so it is usually
   * in cache by the time somebody walks over here.
   */
  const today = new Date().toISOString().slice(0, 10)
  const activity = useActivity(shiftDayKey(today, -TOKEN_RULES.sinks.dayRepairMaxAgeDays), today)
  const repairDay = useRepairDay()
  const purchase = usePurchase()
  const update = useUpdateProfile()
  // The shop needs both to draw a gate's progress; the wallet itself does not.
  const xp = useTokens()

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
  const viewer = { _id: me.data._id, name: me.data.displayName, avatarUrl: me.data.avatarUrl }
  const offers = buildStoreOffers({
    t,
    balance,
    longestStreak: xp.data?.streak.longest ?? 0,
    lifetimeCorrections: xp.data?.lifetime.corrections ?? 0,
    owned,
    streakFreezes: wallet.data?.streakFreezes ?? 0,
    ...(activity.data
      ? {
          repair: {
            today: activity.data.today,
            filled: new Set(activity.data.days.map((day) => day.day)),
            price: activity.data.repair.price,
            usedThisMonth: activity.data.repair.usedThisMonth,
          },
        }
      : {}),
  })

  /**
   * Buying, and saying so.
   *
   * Both halves were missing. The purchase was `purchase.mutate(id)` with no
   * success and no error handler, so a freeze bought at a full bank failed in
   * silence — the button dimmed, nothing else moved, and there was no way to
   * tell a refusal from a slow network.
   *
   * A repair is a different endpoint and a different confirmation, which is
   * why the row carries the day rather than the screen parsing it back out of
   * an id.
   */
  function buy(offer: StoreOffer): void {
    if (offer.repairDay && activity.data) {
      void confirmAndRepair({
        day: offer.repairDay,
        today: activity.data.today,
        filled: new Set(activity.data.days.map((day) => day.day)),
        price: activity.data.repair.price,
        balance,
        left: Math.max(0, activity.data.repair.perMonth - activity.data.repair.usedThisMonth),
        perMonth: activity.data.repair.perMonth,
        t,
        locale,
        repair: (day, handlers) => repairDay.mutate(day, handlers),
      })
      return
    }
    purchase.mutate(offer.id, {
      onSuccess: () => showToast(t('store.bought', { title: offer.title })),
      onError: () => void showAlert(t('store.buyFailed'), t('common.retry')),
    })
  }

  function refresh(): void {
    void Promise.all([me.refetch(), wallet.refetch(), xp.refetch(), activity.refetch()])
  }

  /*
   * Built here rather than in the section so the button exists only when the
   * sentence does: a rank of null is "not on the board", not "#0". The text is
   * period-keyed, which is why it moved here with the tabs.
   */
  const viewerRank = board.data?.viewer.rank
  const rankShare = viewerRank
    ? leaderboardShareText(t, { rank: viewerRank, period, handle: me.data.handle })
    : undefined

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

      {/*
        The token board, directly under the balance it ranks. It used to live
        on the badges page, where it shared a non-scrolling screen with a badge
        grid and could not be reached.
      */}
      <LeaderboardSection
        title={t('leaderboard.title')}
        options={PERIOD_TABS.map((tab) => ({ value: tab, label: periodLabel(t, tab) }))}
        selected={period}
        onSelect={setPeriod}
        pickerLabel={t('leaderboard.periodPicker')}
        entries={board.data?.entries ?? []}
        viewer={board.data?.viewer}
        valueOf={(row) => String((row as { tokens?: number }).tokens ?? 0)}
        viewerValue={String(board.data?.viewer.tokens ?? 0)}
        loading={board.isPending}
        emptyTitle={t('leaderboard.emptyTitle')}
        emptyBody={t('leaderboard.emptyBody')}
        backTo="/(app)/wallet"
        share={rankShare}
      />

      <View style={styles.tiles}>
        <StatTile
          label={t('wallet.streakFreezes')}
          value={String(wallet.data?.streakFreezes ?? 0)}
        />
        <StatTile label={t('wallet.itemsOwned')} value={`${owned.length}/${COSMETICS.length}`} />
      </View>

      {/* Above the shop: what you already have is the answer to "why buy
          another", and it has to be visible before the prices are. */}
      <EquipPicker
        kind="frame"
        owned={owned}
        equipped={wallet.data?.equipped}
        viewer={viewer}
        onEquip={(id) => update.mutate({ equipped: { frame: id } })}
      />
      <EquipPicker
        kind="title"
        owned={owned}
        equipped={wallet.data?.equipped}
        viewer={viewer}
        onEquip={(id) => update.mutate({ equipped: { title: id } })}
      />

      <Text style={styles.sectionTitle}>{t('wallet.storeTitle')}</Text>
      <View style={styles.offers}>
        {offers.map((offer, index) => (
          <StoreRow
            key={offer.id}
            offer={offer}
            pending={purchase.isPending}
            last={index === offers.length - 1}
            onBuy={buy}
            viewer={viewer}
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
