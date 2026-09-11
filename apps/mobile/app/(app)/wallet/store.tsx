import Feather from '@expo/vector-icons/Feather'
import { shiftDayKey, TOKEN_RULES, wornCosmetic } from '@langx/shared'
import { Text, View } from 'react-native'
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
import { StoreRow } from '../../../src/components/store/StoreRow'
import type { StoreOffer } from '../../../src/lib/storeOffers'
import { Screen } from '../../../src/components/ui/Screen'
import { Skeleton } from '../../../src/components/ui/Skeleton'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { showAlert } from '../../../src/lib/alert'
import { track } from '../../../src/lib/analytics'
import { goBackTo } from '../../../src/lib/navigation'
import { confirmAndRepair } from '../../../src/lib/repairFlow'
import { showToast } from '../../../src/lib/toast'
import { buildStoreOffers } from '../../../src/lib/storeOffers'
import { makeStyles, useTheme } from '../../../src/lib/theme'
import { useLocale, useT } from '../../../src/i18n'
import { usePullToRefresh } from '../../../src/hooks/usePullToRefresh'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'

/**
 * The store: what the balance buys, and what you already own.
 *
 * One catalogue in four lists — the consumables, then every sticker pack,
 * then every frame, then every title — with what you own kept in place and
 * marked as worn or wearable. The pickers that used to sit above the prices
 * are gone: a row that says "Wearing" *is* the picker, and it sits next to the
 * price of the rung above, which is the answer to "why buy another". The hourly gift is
 * not here — it is not for sale, so it stays on the wallet's landing page.
 */
export default function StoreScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const { locale } = useLocale()

  const me = useMe()
  const wallet = useWallet()
  /*
   * The window a repair can still reach, so the store can offer the newest day
   * inside it. Same query the heatmap on the streak page already runs, so it is
   * usually in cache by the time somebody walks over here.
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
          <View style={styles.loading}>
            <Skeleton width={140} height={14} />
            <Skeleton height={76} />
            <Skeleton height={76} />
            <Skeleton height={76} />
            <Skeleton height={76} />
          </View>
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
  const items = offers.filter((offer) => !offer.kind)
  const frames = offers.filter((offer) => offer.kind === 'frame')
  const titles = offers.filter((offer) => offer.kind === 'title')
  /*
   * Packs were bought nowhere. This screen listed the three groups it knew
   * about, the catalogue grew a fourth kind, and every sticker pack fell
   * between the filters — so the only thing pointing at a pack was the chat
   * keyboard's button, and it pointed here.
   */
  const stickers = offers.filter((offer) => offer.kind === 'stickers')
  // What is *drawn*, which is the explicit choice or the fallback — so the row
  // marked as worn matches the profile even before anybody has chosen.
  const wornFrame = wornCosmetic(wallet.data?.equipped, owned, 'frame')?.id
  const wornTitle = wornCosmetic(wallet.data?.equipped, owned, 'title')?.id

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
      onSuccess: () => {
        /*
         * On success rather than on the tap: a spend that the server refused
         * is not a spend, and at these volumes a "started" count would be a
         * second number that only ever confuses the first. `title` is left
         * out on purpose — it is translated, so it would arrive in eight
         * spellings for one product; `id` is the same string everywhere.
         */
        track({
          name: 'tokens_spent',
          properties: { sku: offer.id, kind: offer.kind ?? 'consumable', amount: offer.price },
        })
        showToast(t('store.bought', { title: offer.title }))
      },
      onError: () => void showAlert(t('store.buyFailed'), t('common.retry')),
    })
  }

  /**
   * Wearing, and saying so. The row flips at once (the cache is patched
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
      <ScreenHeader
        title={t('wallet.storeTitle')}
        onBack={() => goBackTo('/(app)/wallet')}
        trailing={
          <View
            style={styles.balance}
            accessibilityRole="text"
            accessibilityLabel={`${t('wallet.balance')}: ${balance}`}
          >
            <Feather name="credit-card" size={16} color={colors.textMuted} />
            <Text style={styles.balanceValue}>{balance.toLocaleString(locale)}</Text>
          </View>
        }
      />

      {items.map((offer) => (
        <StoreRow key={offer.id} offer={offer} pending={purchase.isPending} onBuy={buy} />
      ))}

      <Text style={styles.kicker}>{t('store.stickers')}</Text>
      {stickers.map((offer) => (
        <StoreRow key={offer.id} offer={offer} pending={purchase.isPending} onBuy={buy} />
      ))}

      <Text style={styles.kicker}>{t('store.frames')}</Text>
      {frames.map((offer) => (
        <StoreRow
          key={offer.id}
          offer={offer}
          pending={purchase.isPending}
          onBuy={buy}
          viewer={viewer}
          equipped={offer.id === wornFrame}
          onWear={(chosen) => wear({ frame: chosen.id })}
        />
      ))}

      <Text style={styles.kicker}>{t('store.titles')}</Text>
      {titles.map((offer) => (
        <StoreRow
          key={offer.id}
          offer={offer}
          pending={purchase.isPending}
          onBuy={buy}
          equipped={offer.id === wornTitle}
          onWear={(chosen) => wear({ title: chosen.id })}
        />
      ))}
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  loading: { gap: spacing.lg, marginTop: spacing.xxl },
  balance: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  balanceValue: { ...font.heading, color: colors.text, fontSize: 16 },
  kicker: {
    color: colors.textFaint,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingBottom: spacing.xs,
    paddingTop: spacing.xl,
    textTransform: 'uppercase',
  },
}))
