import { shiftDayKey, TOKEN_RULES } from '@langx/shared'
import { ActivityIndicator, Text, View } from 'react-native'
import { LoadFailed } from '../../../src/components/LoadFailed'
import {
  useActivity,
  useEquip,
  useMe,
  usePurchase,
  useRepairDay,
  useTokens,
  useWallet,
} from '../../../src/api/queries'
import { EquipPicker } from '../../../src/components/store/EquipPicker'
import { StoreRow } from '../../../src/components/store/StoreRow'
import type { StoreOffer } from '../../../src/lib/storeOffers'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { showAlert } from '../../../src/lib/alert'
import { goBackTo } from '../../../src/lib/navigation'
import { confirmAndRepair } from '../../../src/lib/repairFlow'
import { showToast } from '../../../src/lib/toast'
import { buildStoreOffers } from '../../../src/lib/storeOffers'
import { makeStyles } from '../../../src/lib/theme'
import { useLocale, useT } from '../../../src/i18n'
import { usePullToRefresh } from '../../../src/hooks/usePullToRefresh'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'

/**
 * The store: what the balance buys, and what you already own.
 *
 * The pickers sit above the prices because what you already have is the
 * answer to "why buy another", and it has to be visible before the prices
 * are. The hourly gift is not here — it is not for sale, so it stays on the
 * wallet's landing page.
 */
export default function StoreScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const t = useT()
  const { locale } = useLocale()

  const me = useMe()
  const wallet = useWallet()
  /*
   * The window a repair can still reach, so the store can offer the newest day
   * inside it. Same query the heatmap on `/me` already runs, so it is usually
   * in cache by the time somebody walks over here.
   */
  const today = new Date().toISOString().slice(0, 10)
  const activity = useActivity(shiftDayKey(today, -TOKEN_RULES.sinks.dayRepairMaxAgeDays), today)
  const repairDay = useRepairDay()
  const purchase = usePurchase()
  const equip = useEquip()
  // The shop needs both to draw a gate's progress.
  const xp = useTokens()
  // Above the early return, where hooks have to be; all four behind one pull.
  const pull = usePullToRefresh(() =>
    Promise.all([me.refetch(), wallet.refetch(), xp.refetch(), activity.refetch()]),
  )

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
   * Both halves were missing once. The purchase was `purchase.mutate(id)` with
   * no success and no error handler, so a freeze bought at a full bank failed
   * in silence — the button dimmed, nothing else moved, and there was no way
   * to tell a refusal from a slow network.
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

  /**
   * Wearing, and saying so. The pill flips at once (the cache is patched
   * before the request leaves), the toast is the confirmation that it stuck,
   * and a refusal both says so and puts the old choice back.
   */
  function wear(equipped: Parameters<typeof equip.mutate>[0]): void {
    equip.mutate(equipped, {
      onSuccess: () => showToast(t('editProfile.saved')),
      onError: () => void showAlert(t('store.equipFailed'), t('common.retry')),
    })
  }

  return (
    <Screen scroll {...pull}>
      <ScreenHeader title={t('wallet.storeTitle')} onBack={() => goBackTo('/(app)/wallet')} />

      <Text style={styles.balance}>
        {t('wallet.balance')} · {balance}
      </Text>

      <EquipPicker
        kind="frame"
        owned={owned}
        equipped={wallet.data?.equipped}
        viewer={viewer}
        onEquip={(id) => wear({ frame: id })}
      />
      <EquipPicker
        kind="title"
        owned={owned}
        equipped={wallet.data?.equipped}
        viewer={viewer}
        onEquip={(id) => wear({ title: id })}
      />

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
  balance: { ...font.label, color: colors.textMuted, marginTop: spacing.md },
  offers: { marginTop: spacing.lg },
  hint: {
    ...font.caption,
    color: colors.textFaint,
    fontSize: 13,
    lineHeight: 21,
    marginBottom: spacing.xxl,
    marginTop: spacing.lg,
  },
}))
