import { TOKEN_RULES, wornCosmetic } from '@langx/shared'
import {
  useActivity,
  useEquip,
  useMe,
  usePurchase,
  useRepairDay,
  useTokens,
  useWallet,
} from '../api/queries'
import { useLocale, useT } from '../i18n'
import { showAlert } from '../lib/alert'
import { track } from '../lib/analytics'
import { confirmAndRepair } from '../lib/repairFlow'
import { buildStoreOffers, repairsUsedFor, type StoreOffer } from '../lib/storeOffers'
import { showToast } from '../lib/toast'
import { usePullToRefresh } from './usePullToRefresh'
import { activityRange, daysOnRecord } from '../lib/activityMap'

/**
 * What the redesign's store screens share: the same five queries today's
 * store runs (and so the same cache entries), the offers built from them by
 * `buildStoreOffers`, and today's purchase and wear, unchanged — the repair's
 * own dialog for a missed day, the purchase and its toast for anything else,
 * and a wear that flips at once and puts the old choice back on a refusal.
 *
 * One hook so the home, a collection and a frame's sheet cannot buy two
 * different ways.
 */
export function useStoreV3() {
  const t = useT()
  const { locale } = useLocale()
  const me = useMe()
  const wallet = useWallet()
  // The same window, and so the same cache entry, today's store reads.
  const range = activityRange(TOKEN_RULES.sinks.dayRepairMaxAgeDays)
  const activity = useActivity(range.from, range.to)
  const repairDay = useRepairDay()
  const purchase = usePurchase()
  const equip = useEquip()
  const xp = useTokens()
  const pull = usePullToRefresh(() =>
    Promise.all([me.refetch(), wallet.refetch(), xp.refetch(), activity.refetch()]),
  )

  const balance = wallet.data?.balance ?? 0
  const owned = wallet.data?.owned ?? []
  const offers = wallet.data
    ? buildStoreOffers({
        t,
        balance,
        longestStreak: xp.data?.streak.longest ?? 0,
        lifetimeCorrections: xp.data?.lifetime.corrections ?? 0,
        owned,
        streakFreezes: wallet.data.streakFreezes,
        ...(activity.data
          ? {
              repair: {
                today: activity.data.today,
                filled: daysOnRecord(activity.data.days, activity.data.streak),
                price: activity.data.repair.price,
                usedThisMonth: activity.data.repair.usedThisMonth,
                usedByMonth: activity.data.repair.usedByMonth,
                ...(activity.data.repair.firstDay
                  ? { firstDay: activity.data.repair.firstDay }
                  : {}),
              },
            }
          : {}),
      })
    : []
  const wornFrame = wornCosmetic(wallet.data?.equipped, owned, 'frame')?.id
  const wornTitle = wornCosmetic(wallet.data?.equipped, owned, 'title')?.id

  /** Today's store's purchase, unchanged: the repair's dialog, or the purchase and its toast. */
  function buy(offer: StoreOffer): void {
    if (offer.repairDay && activity.data) {
      void confirmAndRepair({
        day: offer.repairDay,
        today: activity.data.today,
        filled: daysOnRecord(activity.data.days, activity.data.streak),
        price: activity.data.repair.price,
        balance,
        left: Math.max(
          0,
          activity.data.repair.perMonth - repairsUsedFor(offer.repairDay, activity.data.repair),
        ),
        perMonth: activity.data.repair.perMonth,
        t,
        locale,
        repair: (day, handlers) => repairDay.mutate(day, handlers),
      })
      return
    }
    purchase.mutate(offer.id, {
      onSuccess: () => {
        track({
          name: 'tokens_spent',
          properties: { sku: offer.id, kind: offer.kind ?? 'consumable', amount: offer.price },
        })
        showToast(t('store.bought', { title: offer.title }))
      },
      onError: () => void showAlert(t('store.buyFailed'), t('common.retry')),
    })
  }

  /** Today's store's wear, unchanged: the row flips at once and a refusal puts it back. */
  function wear(equipped: Parameters<typeof equip.mutate>[0]): void {
    equip.mutate(equipped, {
      onSuccess: () => showToast(t('editProfile.saved')),
      onError: () => void showAlert(t('store.equipFailed'), t('common.retry')),
    })
  }

  return {
    me,
    wallet,
    xp,
    pull,
    balance,
    offers,
    wornFrame,
    wornTitle,
    /** Which offer a purchase is in flight for, so only its button spins. */
    pendingId: purchase.isPending ? purchase.variables : undefined,
    pending: purchase.isPending,
    buy,
    wear,
    viewer: me.data
      ? { _id: me.data._id, name: me.data.displayName, avatarUrl: me.data.avatarUrl }
      : undefined,
    progress: {
      longestStreak: xp.data?.streak.longest ?? 0,
      corrections: xp.data?.lifetime.corrections ?? 0,
    },
    progressLoaded: xp.data !== undefined,
  }
}
