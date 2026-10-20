import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import type { CosmeticKind } from '@langx/shared'
import { useFonts } from 'expo-font'
import { router } from 'expo-router'
import { useState, type ReactNode } from 'react'
import { RefreshControl, ScrollView, Text, View } from 'react-native'
import { LoadFailed } from '../components/LoadFailed'
import { FrameDetailSheet } from '../components/store/FrameDetailSheet'
import {
  FrameTile,
  RarityChip,
  RarityHeading,
  TokenGlyph,
  type Viewer,
} from '../components/store/StoreV3Blocks'
import { Avatar } from '../components/ui/Avatar'
import { Button } from '../components/ui/Button'
import { Screen } from '../components/ui/Screen'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { Skeleton } from '../components/ui/Skeleton'
import { StoreGroup, StoreRowV3 } from '../components/wallet/WalletBlocks'
import { useScreenInteractive } from '../hooks/useScreenInteractive'
import { useStoreV3 } from '../hooks/useStoreV3'
import { useLocale, useT, type MessageKey } from '../i18n'
import { authClient } from '../lib/auth-client'
import { shouldGateGuest } from '../lib/guestGate'
import { queryFailed } from '../lib/listState'
import { goBackTo } from '../lib/navigation'
import { frameAction, frameRarity, framesByRarity, initialFrame } from '../lib/storeHome'
import type { StoreOffer } from '../lib/storeOffers'
import { makeStyles, useTheme } from '../lib/theme'
import { GuestStore, StoreHeader } from './WalletStoreScreenV3'

const STORE = '/(app)/wallet/store'
const KINDS: readonly CosmeticKind[] = ['frame', 'title', 'stickers']
const KIND_TITLE: Record<CosmeticKind, MessageKey> = {
  frame: 'storeHome.frames',
  title: 'storeHome.titles',
  stickers: 'storeHome.stickers',
}

/** A `?kind=` this build knows, or frames. */
export function collectionKind(param: string | string[] | undefined): CosmeticKind {
  const value = Array.isArray(param) ? param[0] : param
  return KINDS.find((kind) => kind === value) ?? 'frame'
}

/**
 * One of the store's collections, from `V-ShopFrames`, with the three as tabs
 * along the top.
 *
 * Frames are the drawing: a preview of the chosen frame on your own face —
 * full size, then as a partner sees it in Chats — over the sixteen in a grid
 * by rarity, and the chosen one's action held at the foot. Choosing a tile
 * moves the preview and buys nothing; the footer's Buy is the one yellow, and
 * Details opens the frame's sheet. Titles and sticker packs are today's rows
 * on today's grey block until their own pages land.
 */
export function StoreCollectionScreenV3({ kind }: { kind: CosmeticKind }) {
  const { data: session } = authClient.useSession()
  return shouldGateGuest(session?.user) ? <GuestStore /> : <Collection initial={kind} />
}

function Collection({ initial }: { initial: CosmeticKind }) {
  useScreenInteractive()
  const t = useT()
  const { v3 } = useTheme()
  const styles = useStyles()
  const [blackLoaded] = useFonts({ Nunito_900Black })
  const store = useStoreV3()
  const [kind, setKind] = useState(initial)

  const { me, wallet, balance, offers, viewer } = store
  const header = (
    <View style={styles.head}>
      <StoreHeader
        title={t(KIND_TITLE[kind])}
        black={blackLoaded}
        balance={wallet.data ? balance : undefined}
        onBack={() => goBackTo(STORE)}
      />
      <SegmentedControl
        accessibilityLabel={t('storeHome.collectionsTabs')}
        options={KINDS.map((value) => ({ value, label: t(KIND_TITLE[value]) }))}
        selected={[kind]}
        onToggle={(value) => {
          setKind(value)
          // Kept in the address too, so back from a sheet or a reload lands here.
          router.setParams({ kind: value })
        }}
      />
    </View>
  )

  if (!me.data || !wallet.data || !viewer) {
    const failed = queryFailed(me) || (!wallet.data && queryFailed(wallet))
    return (
      <Screen ground={v3.colors.bg} fluid>
        {header}
        {failed ? (
          <LoadFailed
            onRetry={() => {
              void me.refetch()
              void wallet.refetch()
            }}
          />
        ) : (
          <View style={styles.loading}>
            <Skeleton height={150} radius={v3.radius.badge} />
            <Skeleton height={130} radius={v3.radius.card} />
            <Skeleton height={130} radius={v3.radius.card} />
          </View>
        )}
      </Screen>
    )
  }

  if (kind !== 'frame') {
    const worn = kind === 'title' ? store.wornTitle : undefined
    return (
      <Screen ground={v3.colors.bg} fluid>
        {header}
        <ScrollView
          style={styles.fill}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl {...store.pull} />}
        >
          <StoreGroup>
            {offers
              .filter((offer) => offer.kind === kind)
              .map((offer, index) => (
                <StoreRowV3
                  key={offer.id}
                  offer={offer}
                  pending={store.pending}
                  balance={balance}
                  first={index === 0}
                  onBuy={store.buy}
                  {...(kind === 'title'
                    ? {
                        hue: v3.hues.lilac,
                        equipped: offer.id === worn,
                        onWear: (chosen: StoreOffer) => store.wear({ title: chosen.id }),
                      }
                    : { hue: v3.hues.sky })}
                />
              ))}
          </StoreGroup>
        </ScrollView>
      </Screen>
    )
  }

  return <Frames header={header} store={store} viewer={viewer} />
}

function Frames({
  header,
  store,
  viewer,
}: {
  header: ReactNode
  store: ReturnType<typeof useStoreV3>
  viewer: Viewer
}) {
  const t = useT()
  const { locale } = useLocale()
  const { v3 } = useTheme()
  const styles = useStyles()
  const frames = store.offers.filter((offer) => offer.kind === 'frame')
  const [chosenId, setChosenId] = useState(() => initialFrame(frames, store.wornFrame)?.id)
  const [sheetId, setSheetId] = useState<string>()
  const chosen = frames.find((offer) => offer.id === chosenId) ?? frames[0]
  const sheet = frames.find((offer) => offer.id === sheetId)
  if (!chosen) return null

  const n = (value: number) => value.toLocaleString(locale)
  const action = frameAction(chosen, store.wornFrame)
  const price = t('wallet.price', { count: chosen.price, amount: n(chosen.price) })
  const left = store.balance - chosen.price

  return (
    <Screen ground={v3.colors.bg} fluid>
      {header}
      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.grid}
        refreshControl={<RefreshControl {...store.pull} />}
      >
        <View style={styles.preview}>
          <View style={styles.previewTop}>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Avatar
                url={viewer.avatarUrl}
                name={viewer.name}
                seed={viewer._id}
                size={64}
                frame={chosen.tone}
              />
            </View>
            <View style={styles.previewText}>
              <RarityChip rarity={frameRarity(chosen.id)} />
              <Text style={styles.previewTitle} accessibilityRole="header">
                {chosen.title}
              </Text>
              <Text style={styles.muted}>
                {t(`storeHome.frameAbout.${chosen.id.split('.')[1] ?? ''}` as MessageKey)}
              </Text>
              {action === 'buy' ? (
                <Text style={styles.mutedSmall}>
                  {t('storeHome.leftAfterBuying', { count: left, amount: n(left) })}
                </Text>
              ) : null}
            </View>
          </View>
          <Text style={styles.mutedSmall}>{t('storeHome.inChats')}</Text>
          <View
            style={styles.chatRow}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Avatar
              url={viewer.avatarUrl}
              name={viewer.name}
              seed={viewer._id}
              size={40}
              frame={chosen.tone}
            />
            <Text style={styles.chatName} numberOfLines={1}>
              {viewer.name}
            </Text>
          </View>
          <Button
            variant="secondary"
            size="small"
            label={t('storeHome.details')}
            accessibilityLabel={t('storeHome.detailsA11y', { title: chosen.title })}
            onPress={() => setSheetId(chosen.id)}
            style={styles.details}
          />
        </View>

        {framesByRarity(frames).map((group) => {
          const owned = group.frames.filter((offer) => offer.owned).length
          const total = group.frames.length
          const note =
            owned === total
              ? t('storeHome.allOwned', { count: total })
              : group.rarity === 'legendary' && group.frames.every((offer) => offer.locked)
                ? t('storeHome.gated')
                : t('storeHome.ownedOf', { count: total, owned: n(owned) })
          return (
            <View key={group.rarity} style={styles.group}>
              <RarityHeading rarity={group.rarity} note={note} />
              {rows(group.frames).map((row) => (
                <View key={row[0]!.id} style={styles.row}>
                  {row.map((offer) => (
                    <FrameTile
                      key={offer.id}
                      offer={offer}
                      viewer={viewer}
                      worn={offer.id === store.wornFrame}
                      selected={offer.id === chosen.id}
                      onPress={() => setChosenId(offer.id)}
                    />
                  ))}
                  {/* Holes, so a short last row keeps the grid's columns. */}
                  {Array.from({ length: COLUMNS - row.length }, (_, i) => (
                    <View key={i} style={styles.hole} />
                  ))}
                </View>
              ))}
            </View>
          )
        })}
      </ScrollView>

      <View style={styles.footer}>
        {action === 'buy' ? (
          <Button
            label={t('storeHome.buyFor', { amount: n(chosen.price) })}
            accessibilityLabel={t('store.buyAccessibility', { title: chosen.title, price })}
            icon={<TokenGlyph size={v3.icon.lg} color={v3.colors.onYellow} />}
            loading={store.pendingId === chosen.id}
            onPress={() => store.buy(chosen)}
          />
        ) : action === 'wear' ? (
          <Button
            variant="blue"
            label={t('store.wear')}
            onPress={() => store.wear({ frame: chosen.id })}
          />
        ) : action === 'wearing' ? (
          <Button
            variant="secondary"
            icon="check"
            disabled
            label={t('store.wearing')}
            onPress={() => undefined}
          />
        ) : action === 'short' ? (
          <Button
            variant="secondary"
            disabled
            label={t('storeHome.moreTokens', {
              count: chosen.price - store.balance,
              amount: n(chosen.price - store.balance),
            })}
            onPress={() => undefined}
          />
        ) : (
          <Button
            variant="secondary"
            icon="lock"
            label={
              action === 'ladder' && chosen.needs
                ? t('storeHome.opensAfter', { title: chosen.needs })
                : t('storeHome.notYet')
            }
            onPress={() => setSheetId(chosen.id)}
          />
        )}
      </View>

      <FrameDetailSheet
        offer={sheet}
        viewer={viewer}
        balance={store.balance}
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

const COLUMNS = 3
function rows<T>(items: readonly T[]): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += COLUMNS) out.push(items.slice(i, i + COLUMNS))
  return out
}

const useStyles = makeStyles(({ v3 }) => ({
  fill: { flex: 1 },
  head: { gap: v3.space[8], paddingBottom: v3.space[8] },
  loading: { gap: v3.space[12], paddingTop: v3.space[8] },
  list: { paddingBottom: v3.space[24], paddingTop: v3.space[8] },
  grid: { gap: v3.space[8], paddingBottom: v3.space[24], paddingTop: v3.space[4] },
  muted: { ...v3.type.caption, color: v3.colors.muted },
  mutedSmall: { ...v3.type.label, color: v3.colors.muted },
  preview: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.badge,
    gap: v3.space[8],
    padding: v3.space[12],
  },
  previewTop: { alignItems: 'center', flexDirection: 'row', gap: v3.space[12] },
  previewText: { flex: 1, gap: v3.space[4], minWidth: 0 },
  previewTitle: { ...v3.type.headline, color: v3.colors.fg },
  chatRow: {
    alignItems: 'center',
    backgroundColor: v3.colors.bg,
    borderRadius: v3.radius.row,
    flexDirection: 'row',
    gap: v3.space[10],
    minHeight: 64,
    paddingHorizontal: v3.space[8],
  },
  chatName: { ...v3.type.button, color: v3.colors.fg, flex: 1 },
  details: { alignSelf: 'flex-start', width: 'auto' },
  group: { gap: v3.space[8] },
  row: { flexDirection: 'row', gap: v3.space[8] },
  hole: { flex: 1 },
  footer: {
    borderTopColor: v3.colors.line,
    borderTopWidth: 1,
    gap: v3.space[4],
    marginHorizontal: -20,
    paddingHorizontal: 20,
    paddingTop: v3.space[10],
  },
}))
