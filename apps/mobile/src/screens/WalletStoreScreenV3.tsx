import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import { shiftDayKey, TOKEN_RULES, wornCosmetic } from '@langx/shared'
import { useFonts } from 'expo-font'
import { View } from 'react-native'
import {
  useActivity,
  useEquip,
  useMe,
  usePurchase,
  useRepairDay,
  useTokens,
  useWallet,
} from '../api/queries'
import { LoadFailed } from '../components/LoadFailed'
import { HomeAccountCard } from '../components/home/HomeBlocks'
import { Screen } from '../components/ui/Screen'
import { Skeleton } from '../components/ui/Skeleton'
import {
  StoreGroup,
  StoreRowV3,
  StoreSectionHead,
  WalletHeader,
} from '../components/wallet/WalletBlocks'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { useScreenInteractive } from '../hooks/useScreenInteractive'
import { useLocale, useT } from '../i18n'
import { showAlert } from '../lib/alert'
import { track } from '../lib/analytics'
import { authClient } from '../lib/auth-client'
import { shouldGateGuest } from '../lib/guestGate'
import { queryFailed } from '../lib/listState'
import { goBackTo } from '../lib/navigation'
import { confirmAndRepair } from '../lib/repairFlow'
import { requireAccount } from '../lib/requireAccount'
import { buildStoreOffers, repairsUsedFor, type StoreOffer } from '../lib/storeOffers'
import { makeStyles, useTheme, type PartnerHue } from '../lib/theme'
import { showToast } from '../lib/toast'

const WALLET = '/(app)/wallet'

/** A sticker pack's square, by its place in the catalogue, as the drawing colours them. */
const PACK_HUES: readonly PartnerHue[] = ['aqua', 'tangerine', 'lime']

/**
 * The redesign's store, behind `flags.v3Home` (`app/(app)/wallet/store.tsx`
 * picks it). Drawn from `V-WalletStore`.
 *
 * Today's catalogue, today's prices and today's flow, on v3's blocks: the
 * consumables, then the sticker packs, the frames and the titles, each on its
 * grey block. Every row's Buy is the large outlined pill with the price on it
 * (`StoreRowV3`); the screen has no yellow, because no single row is the one
 * thing this screen is for. Prices come from `buildStoreOffers`, which reads
 * them from `TOKEN_RULES` and `COSMETICS`, and buying is the same request and
 * the same confirmation as today — a toast for an item, the repair's own
 * dialog for a missed day.
 */
export function WalletStoreScreenV3() {
  const { data: session } = authClient.useSession()
  return shouldGateGuest(session?.user) ? <GuestStore /> : <MemberStore />
}

function MemberStore() {
  useScreenInteractive()
  const t = useT()
  const { locale } = useLocale()
  const { v3 } = useTheme()
  const styles = useStyles()
  const [blackLoaded] = useFonts({ Nunito_900Black })

  const me = useMe()
  const wallet = useWallet()
  // The same window, and so the same cache entry, today's store reads.
  const today = new Date().toISOString().slice(0, 10)
  const activity = useActivity(shiftDayKey(today, -TOKEN_RULES.sinks.dayRepairMaxAgeDays), today)
  const repairDay = useRepairDay()
  const purchase = usePurchase()
  const equip = useEquip()
  const xp = useTokens()
  const pull = usePullToRefresh(() =>
    Promise.all([me.refetch(), wallet.refetch(), xp.refetch(), activity.refetch()]),
  )

  const balanceValue = (wallet.data?.balance ?? 0).toLocaleString(locale)
  const header = (
    <WalletHeader
      title={t('wallet.storeTitle')}
      subtitle={t('wallet.storeBody')}
      black={blackLoaded}
      onBack={() => goBackTo(WALLET)}
      balance={
        wallet.data
          ? {
              label: t('wallet.balance'),
              value: balanceValue,
              a11y: `${t('wallet.balance')}: ${t('wallet.price', { count: wallet.data.balance, amount: balanceValue })}`,
            }
          : undefined
      }
    />
  )

  if (!me.data || !wallet.data) {
    const failed = queryFailed(me) || (!wallet.data && queryFailed(wallet))
    return (
      <Screen ground={v3.colors.bg}>
        {header}
        {failed ? (
          <LoadFailed
            onRetry={() => {
              void me.refetch()
              void wallet.refetch()
            }}
          />
        ) : (
          <View style={styles.stack}>
            <Skeleton height={140} radius={v3.radius.tile} />
            <Skeleton width={140} height={20} />
            <Skeleton height={210} radius={v3.radius.tile} />
          </View>
        )}
      </Screen>
    )
  }

  const balance = wallet.data.balance
  const owned = wallet.data.owned
  const viewer = { _id: me.data._id, name: me.data.displayName, avatarUrl: me.data.avatarUrl }
  const offers = buildStoreOffers({
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
            filled: new Set(activity.data.days.map((day) => day.day)),
            price: activity.data.repair.price,
            usedThisMonth: activity.data.repair.usedThisMonth,
            usedByMonth: activity.data.repair.usedByMonth,
            ...(activity.data.repair.firstDay ? { firstDay: activity.data.repair.firstDay } : {}),
          },
        }
      : {}),
  })
  const items = offers.filter((offer) => !offer.kind)
  const stickers = offers.filter((offer) => offer.kind === 'stickers')
  const frames = offers.filter((offer) => offer.kind === 'frame')
  const titles = offers.filter((offer) => offer.kind === 'title')
  const wornFrame = wornCosmetic(wallet.data.equipped, owned, 'frame')?.id
  const wornTitle = wornCosmetic(wallet.data.equipped, owned, 'title')?.id

  /** Today's store's purchase, unchanged: the repair's dialog, or the purchase and its toast. */
  function buy(offer: StoreOffer): void {
    if (offer.repairDay && activity.data) {
      void confirmAndRepair({
        day: offer.repairDay,
        today: activity.data.today,
        filled: new Set(activity.data.days.map((day) => day.day)),
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

  const row = (
    offer: StoreOffer,
    index: number,
    extra: Partial<Parameters<typeof StoreRowV3>[0]>,
  ) => (
    <StoreRowV3
      key={offer.id}
      offer={offer}
      pending={purchase.isPending}
      balance={balance}
      first={index === 0}
      onBuy={buy}
      {...extra}
    />
  )

  return (
    <Screen scroll ground={v3.colors.bg} {...pull}>
      {header}
      <View style={styles.stack}>
        <StoreGroup>
          {items.map((offer, index) =>
            row(offer, index, { hue: offer.repairDay ? v3.hues.tangerine : v3.hues.sky }),
          )}
        </StoreGroup>

        <StoreSectionHead title={t('store.stickers')} />
        <StoreGroup>
          {stickers.map((offer, index) =>
            row(offer, index, { hue: v3.hues[PACK_HUES[index % PACK_HUES.length]!] }),
          )}
        </StoreGroup>

        <StoreSectionHead title={t('store.frames')} />
        <StoreGroup>
          {frames.map((offer, index) =>
            row(offer, index, {
              viewer,
              equipped: offer.id === wornFrame,
              onWear: (chosen) => wear({ frame: chosen.id }),
            }),
          )}
        </StoreGroup>

        <StoreSectionHead title={t('store.titles')} />
        <StoreGroup>
          {titles.map((offer, index) =>
            row(offer, index, {
              hue: v3.hues.lilac,
              equipped: offer.id === wornTitle,
              onWear: (chosen) => wear({ title: chosen.id }),
            }),
          )}
        </StoreGroup>
      </View>
    </Screen>
  )
}

/** A guest has nothing to spend (rule 9): the account, on the screen's one yellow. */
function GuestStore() {
  useScreenInteractive()
  const t = useT()
  const { v3 } = useTheme()
  const styles = useStyles()
  const [blackLoaded] = useFonts({ Nunito_900Black })
  const { data: session } = authClient.useSession()
  return (
    <Screen scroll ground={v3.colors.bg}>
      <WalletHeader
        title={t('wallet.storeTitle')}
        black={blackLoaded}
        onBack={() => goBackTo(WALLET)}
      />
      <View style={styles.stack}>
        <HomeAccountCard
          title={t('home.guestTitle')}
          body={t('home.guestBody')}
          button={t('welcome.createAccount')}
          onPress={() => void requireAccount(session?.user, { action: 'other' })}
        />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  stack: { gap: v3.space[8], paddingBottom: v3.space[16], paddingTop: v3.space[6] },
}))
