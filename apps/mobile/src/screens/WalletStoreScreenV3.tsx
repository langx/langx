import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import { findCosmetic } from '@langx/shared'
import { useFonts } from 'expo-font'
import { router } from 'expo-router'
import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { LoadFailed } from '../components/LoadFailed'
import { HomeAccountCard } from '../components/home/HomeBlocks'
import { FrameDetailSheet } from '../components/store/FrameDetailSheet'
import {
  CollectionTile,
  FeaturedFramesCard,
  FeaturedPacksCard,
  FeaturedRow,
  OfferArt,
  StoreHeading,
  UpNextTile,
  WithinReachCard,
} from '../components/store/StoreV3Blocks'
import { Screen } from '../components/ui/Screen'
import { Skeleton } from '../components/ui/Skeleton'
import { StoreGroup, StoreRowV3, WalletHeader } from '../components/wallet/WalletBlocks'
import { useScreenInteractive } from '../hooks/useScreenInteractive'
import { useStoreV3 } from '../hooks/useStoreV3'
import { useLocale, useT } from '../i18n'
import { authClient } from '../lib/auth-client'
import { shouldGateGuest } from '../lib/guestGate'
import { queryFailed } from '../lib/listState'
import { goBackTo } from '../lib/navigation'
import { requireAccount } from '../lib/requireAccount'
import { collectionCount, upNext, withinReach } from '../lib/storeHome'
import type { StoreOffer } from '../lib/storeOffers'
import type { CosmeticKind } from '@langx/shared'
import { makeStyles, useTheme } from '../lib/theme'

const WALLET = '/(app)/wallet'

/** A collection's page: frames get the grid, titles and packs today's list. */
export function openCollection(kind: CosmeticKind): void {
  router.push({ pathname: '/(app)/wallet/collection', params: { kind } })
}

/**
 * The redesign's store home, behind `flags.v3Home` (`app/(app)/wallet/store.tsx`
 * picks it). Drawn from `V-Shop`.
 *
 * From the top: the featured collections on their own grounds, the one thing
 * the balance buys right now — the screen's only yellow — what is next on
 * each ladder, the three collections, and the streak's freeze and repair,
 * which are today's rows on today's grey block. Every price is today's, from
 * `buildStoreOffers`, and every purchase is today's (`useStoreV3`).
 *
 * The drawing's "New this week" became "Up next": nothing in the catalogue
 * records when an item arrived, so a row that called things new would have
 * been a claim with nothing behind it (`upNext` says more).
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
  const store = useStoreV3()
  const [sheetId, setSheetId] = useState<string>()

  const { me, wallet, balance, offers, viewer } = store
  const header = (
    <StoreHeader
      black={blackLoaded}
      balance={wallet.data ? balance : undefined}
      onBack={() => goBackTo(WALLET)}
    />
  )

  if (!me.data || !wallet.data || !viewer) {
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
            <Skeleton height={176} radius={v3.radius.block} />
            <Skeleton height={80} radius={v3.radius.tile} />
            <Skeleton width={140} height={20} />
            <Skeleton height={150} radius={v3.radius.tile} />
          </View>
        )}
      </Screen>
    )
  }

  const items = offers.filter((offer) => !offer.kind)
  const frames = offers.filter((offer) => offer.kind === 'frame')
  const packs = offers.filter((offer) => offer.kind === 'stickers')
  const reach = withinReach(offers)
  const next = upNext(offers, reach?.id)
  const aurora = offers.find((offer) => offer.id === 'frame.aurora')
  const auroraGate = findCosmetic('frame.aurora')?.requires
  const sheet = offers.find((offer) => offer.id === sheetId)

  const count = (kind: CosmeticKind): string => {
    const { owned, total } = collectionCount(offers, kind)
    return owned === 0
      ? t('storeHome.toCollect', { count: total })
      : owned === total
        ? t('storeHome.allOwned', { count: total })
        : t('storeHome.ownedOf', { count: total, owned: owned.toLocaleString(locale) })
  }
  const open = (offer: StoreOffer): void => {
    if (offer.kind === 'frame') setSheetId(offer.id)
    else if (offer.kind) openCollection(offer.kind)
  }
  // The first two frames you would see in the grid, and a pack's first sticker.
  const sample = (kind: CosmeticKind) => offers.filter((offer) => offer.kind === kind).slice(0, 2)

  return (
    <Screen scroll ground={v3.colors.bg} {...store.pull}>
      {header}
      <View style={styles.stack}>
        <FeaturedRow>
          <FeaturedFramesCard
            viewer={viewer}
            count={frames.length}
            gate={
              aurora && !aurora.owned && store.progressLoaded && auroraGate
                ? {
                    streak: store.progress.longestStreak,
                    streakGoal: auroraGate.longestStreak ?? 0,
                    corrections: store.progress.corrections,
                    correctionsGoal: auroraGate.corrections ?? 0,
                  }
                : undefined
            }
            onPress={() => openCollection('frame')}
          />
          {packs.length > 0 ? (
            <FeaturedPacksCard packs={packs} onPress={() => openCollection('stickers')} />
          ) : null}
        </FeaturedRow>

        {reach ? (
          <WithinReachCard
            offer={reach}
            balance={balance}
            viewer={viewer}
            pending={store.pendingId === reach.id}
            onBuy={() => store.buy(reach)}
          />
        ) : null}

        {next.length > 0 ? (
          <View style={styles.section}>
            <StoreHeading title={t('storeHome.upNext')} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.bleed}
              contentContainerStyle={styles.bleedContent}
            >
              {next.map((offer) => (
                <UpNextTile
                  key={offer.id}
                  offer={offer}
                  viewer={viewer}
                  onPress={() => open(offer)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.section}>
          <StoreHeading title={t('storeHome.collections')} />
          <View style={styles.collections}>
            <CollectionTile
              title={t('storeHome.frames')}
              count={count('frame')}
              hue={v3.hues.tangerine}
              art={
                <View style={styles.pair}>
                  {sample('frame').map((offer) => (
                    <OfferArt key={offer.id} offer={offer} viewer={viewer} size={36} />
                  ))}
                </View>
              }
              onPress={() => openCollection('frame')}
            />
            <CollectionTile
              title={t('storeHome.titles')}
              count={count('title')}
              hue={v3.hues.lilac}
              art={<OfferArt offer={sample('title')[0]!} viewer={viewer} size={44} />}
              onPress={() => openCollection('title')}
            />
            <CollectionTile
              title={t('storeHome.stickers')}
              count={count('stickers')}
              hue={v3.hues.sky}
              art={packs[0] ? <OfferArt offer={packs[0]} viewer={viewer} size={52} /> : null}
              onPress={() => openCollection('stickers')}
            />
          </View>
        </View>

        <View style={styles.section}>
          <StoreHeading title={t('storeHome.streakSection')} />
          <StoreGroup>
            {items.map((offer, index) => (
              <StoreRowV3
                key={offer.id}
                offer={offer}
                pending={store.pending}
                balance={balance}
                first={index === 0}
                onBuy={store.buy}
                hue={offer.repairDay ? v3.hues.tangerine : v3.hues.sky}
              />
            ))}
          </StoreGroup>
        </View>
      </View>

      <FrameDetailSheet
        offer={sheet}
        viewer={viewer}
        balance={balance}
        worn={store.wornFrame}
        progress={store.progress}
        pending={sheet !== undefined && store.pendingId === sheet.id}
        onBuy={store.buy}
        onWear={(offer) => store.wear({ frame: offer.id })}
        onClose={() => setSheetId(undefined)}
      />
    </Screen>
  )
}

/** The store's header: back, the title and the balance, as the wallet draws it. */
export function StoreHeader({
  title,
  black,
  balance,
  onBack,
}: {
  title?: string
  black: boolean
  balance: number | undefined
  onBack: () => void
}) {
  const t = useT()
  const { locale } = useLocale()
  const value = balance?.toLocaleString(locale) ?? ''
  return (
    <WalletHeader
      title={title ?? t('wallet.storeTitle')}
      black={black}
      onBack={onBack}
      balance={
        balance === undefined
          ? undefined
          : {
              label: t('wallet.balance'),
              value,
              a11y: `${t('wallet.balance')}: ${t('wallet.price', { count: balance, amount: value })}`,
            }
      }
    />
  )
}

/** A guest has nothing to spend (rule 9): the account, on the screen's one yellow. */
export function GuestStore() {
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
  stack: { gap: v3.space[16], paddingBottom: v3.space[16], paddingTop: v3.space[6] },
  section: { gap: v3.space[8] },
  // The screen's gutter is 20 (`Screen`): a sideways row pulls out of it to
  // run to the edges, and pads back in so its first tile lines up.
  bleed: { marginHorizontal: -20 },
  bleedContent: { gap: v3.space[10], paddingHorizontal: 20 },
  collections: { flexDirection: 'row', gap: v3.space[8] },
  pair: { flexDirection: 'row', gap: v3.space[2] },
}))
