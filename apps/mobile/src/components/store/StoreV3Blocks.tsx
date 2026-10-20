import Feather from '@expo/vector-icons/Feather'
import { Image } from 'expo-image'
import type { ReactNode } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { useLocale, useT, type MessageKey } from '../../i18n'
import { frameRarity, type Rarity } from '../../lib/storeHome'
import type { StoreOffer } from '../../lib/storeOffers'
import { FEATURE_COLORS, RARITY_COLORS } from '../../lib/storePalette'
import { stickerAsset } from '../../lib/stickerAssets'
import { makeStyles, useTheme } from '../../lib/theme'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { ICON_BUTTON_TARGET } from '../ui/IconButton'

/*
 * The blocks of the redesign's token store — its home, its collections and a
 * frame's sheet — drawn from `V-Shop`, `V-ShopFrames` and
 * `V-ShopFrameDetail`. Dumb, as the wallet's blocks are: the screens pick the
 * offers (`lib/storeHome.ts`) and these draw them.
 *
 * Every price is a number of tokens beside the token mark, never a currency,
 * and the one yellow on a screen is the screen's to place — no block here
 * draws it unless it is handed the Buy.
 */

export type Viewer = { _id: string; name: string; avatarUrl?: string | undefined }

/** The token mark: a four-pointed spark. A point, not a coin. */
export function TokenGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2.5l2.4 7.1 7.1 2.4-7.1 2.4-2.4 7.1-2.4-7.1L2.5 12l7.1-2.4z" fill={color} />
    </Svg>
  )
}

/**
 * "✦ 6,000": a price as the drawings set it. Hidden from a screen reader —
 * the block it sits in says "6,000 tokens" in words, which the mark cannot.
 */
export function TokenAmount({
  amount,
  color,
  glyphColor,
  muted = false,
}: {
  amount: number
  color?: string | undefined
  glyphColor?: string | undefined
  muted?: boolean
}) {
  const { locale } = useLocale()
  const { v3 } = useTheme()
  const styles = useStyles()
  const ink = color ?? (muted ? v3.colors.muted : v3.colors.fg)
  return (
    <View
      style={styles.amount}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <TokenGlyph size={v3.icon.xs} color={glyphColor ?? v3.colors.blue} />
      <Text style={[styles.amountText, { color: ink }]}>{amount.toLocaleString(locale)}</Text>
    </View>
  )
}

const RARITY_KEY: Record<Rarity, MessageKey> = {
  common: 'storeHome.rarityCommon',
  rare: 'storeHome.rarityRare',
  epic: 'storeHome.rarityEpic',
  legendary: 'storeHome.rarityLegendary',
}

/** How many pips a rarity's chip carries: one to four, as the boards draw them. */
const RARITY_PIPS: Record<Rarity, number> = { common: 1, rare: 2, epic: 3, legendary: 4 }

export function rarityLabel(t: ReturnType<typeof useT>, rarity: Rarity): string {
  return t(RARITY_KEY[rarity])
}

/** "◆◆ Rare": a frame's rarity, in its own colour. Pips as well as a word, never colour alone. */
export function RarityChip({ rarity }: { rarity: Rarity }) {
  const t = useT()
  const { scheme } = useTheme()
  const styles = useStyles()
  const { bg, fg } = RARITY_COLORS[scheme][rarity]
  return (
    <View style={[styles.rarity, { backgroundColor: bg }]}>
      <View
        style={styles.pips}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {Array.from({ length: RARITY_PIPS[rarity] }, (_, i) => (
          <View key={i} style={[styles.pip, { backgroundColor: fg }]} />
        ))}
      </View>
      <Text style={[styles.rarityText, { color: fg }]}>{rarityLabel(t, rarity)}</Text>
    </View>
  )
}

/** The store's section heading — "Up next", "Collections". */
export function StoreHeading({ title }: { title: string }) {
  const styles = useStyles()
  return (
    <Text style={styles.heading} accessibilityRole="header">
      {title}
    </Text>
  )
}

/**
 * The featured cards, side by side and scrolled sideways. They bleed to the
 * screen's edges, as the drawing has them, by pulling out of the gutter and
 * padding back in. Laid out by the writing direction, so in Arabic the first
 * card is at the right.
 */
export function FeaturedRow({ children }: { children: ReactNode }) {
  const styles = useStyles()
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.featuredRow}
      contentContainerStyle={styles.featuredContent}
    >
      {children}
    </ScrollView>
  )
}

/**
 * "Crafted frames": the frames collection on lacquer, with Aurora Glass drawn
 * at the full cut and the two gates beside it in the account's real counts.
 * Still here: the glass's sweep runs only in a frame's own sheet.
 */
export function FeaturedFramesCard({
  viewer,
  count,
  gate,
  onPress,
}: {
  viewer: Viewer
  count: number
  /** Aurora Glass's gate, or nothing once it is owned or before the counts load. */
  gate?:
    { streak: number; streakGoal: number; corrections: number; correctionsGoal: number } | undefined
  onPress: () => void
}) {
  const t = useT()
  const { locale } = useLocale()
  const { scheme } = useTheme()
  const styles = useStyles()
  const c = FEATURE_COLORS[scheme]
  const fraction = (n: number, of: number) => `${Math.round(Math.min(1, n / of) * 100)}%` as const
  return (
    <View style={[styles.featured, { backgroundColor: c.lacquer, borderColor: c.lacquerEdge }]}>
      <View style={styles.featuredText}>
        <Text style={[styles.kicker, { color: c.lacquerKicker }]}>
          {t('storeHome.featuredKicker')}
        </Text>
        <Text style={[styles.featuredTitle, { color: c.onLacquer }]}>
          {t('storeHome.framesTitle')}
        </Text>
        <Text style={[styles.featuredBody, { color: c.onLacquerMuted }]}>
          {t('storeHome.framesBody', { count })}
        </Text>
        <View style={styles.flex} />
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => [
            styles.outlinePill,
            { borderColor: c.onLacquerMuted },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.pillLabel, { color: c.onLacquer }]}>
            {t('storeHome.seeAll', { count })}
          </Text>
        </Pressable>
      </View>
      <View style={styles.featuredArt}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Avatar
            url={viewer.avatarUrl}
            name={viewer.name}
            seed={viewer._id}
            size={64}
            frame="aurora"
          />
        </View>
        {gate ? (
          <View
            style={styles.gateMini}
            accessible
            accessibilityLabel={t('storeHome.auroraGate', {
              streak: gate.streak.toLocaleString(locale),
              streakGoal: gate.streakGoal.toLocaleString(locale),
              corrections: gate.corrections.toLocaleString(locale),
              correctionsGoal: gate.correctionsGoal.toLocaleString(locale),
            })}
          >
            {[
              [gate.streak, gate.streakGoal],
              [gate.corrections, gate.correctionsGoal],
            ].map(([n, of]) => (
              <View key={of} style={styles.gateMiniRow}>
                <View style={[styles.gateMiniTrack, { backgroundColor: c.lacquerTrack }]}>
                  <View
                    style={[
                      styles.gateMiniFill,
                      { backgroundColor: c.lacquerFill, width: fraction(n!, of!) },
                    ]}
                  />
                </View>
                <Text style={[styles.gateMiniText, { color: c.onLacquerMuted }]}>
                  {t('storeHome.gateProgress', {
                    current: n!.toLocaleString(locale),
                    threshold: of!.toLocaleString(locale),
                  })}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  )
}

/** The sticker packs on paper, with a picture from each. */
export function FeaturedPacksCard({
  packs,
  onPress,
}: {
  packs: readonly StoreOffer[]
  onPress: () => void
}) {
  const t = useT()
  const { scheme } = useTheme()
  const styles = useStyles()
  const c = FEATURE_COLORS[scheme]
  return (
    <View style={[styles.featured, { backgroundColor: c.paper, borderColor: c.paper }]}>
      <View style={styles.featuredText}>
        <Text style={[styles.kicker, { color: c.onPaper }]}>{t('storeHome.packsKicker')}</Text>
        <Text style={[styles.featuredTitle, { color: c.onPaper }]}>{t('store.stickers')}</Text>
        <Text style={[styles.featuredBody, { color: c.onPaper }]}>
          {t('storeHome.packsBody', { count: packs.length })}
        </Text>
        <View style={styles.flex} />
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => [
            styles.outlinePill,
            { borderColor: c.onPaper },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.pillLabel, { color: c.onPaper }]}>
            {t('storeHome.seeAll', { count: packs.length })}
          </Text>
        </Pressable>
      </View>
      <View
        style={styles.packArt}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {packs.slice(0, 3).map((pack, i) => (
          <PackPicture
            key={pack.id}
            pack={pack}
            style={i === 1 ? styles.packTilt : styles.packTiltBack}
          />
        ))}
      </View>
    </View>
  )
}

function PackPicture({ pack, style }: { pack: StoreOffer; style?: object }) {
  const styles = useStyles()
  const first = pack.stickers?.[0]
  const picture = first ? stickerAsset(pack.id, first) : undefined
  return picture ? (
    <Image source={picture} style={[styles.packPicture, style]} contentFit="contain" />
  ) : null
}

/**
 * The one thing the balance buys right now, and the screen's one yellow:
 * "Within reach · Washi Tape · ✦ 1,750 · 590 left after". Buys at once, as a
 * row in today's store does; the toast is the receipt.
 */
export function WithinReachCard({
  offer,
  balance,
  viewer,
  pending,
  onBuy,
}: {
  offer: StoreOffer
  balance: number
  viewer: Viewer
  pending: boolean
  onBuy: () => void
}) {
  const t = useT()
  const { locale } = useLocale()
  const { v3 } = useTheme()
  const styles = useStyles()
  const left = balance - offer.price
  const price = t('wallet.price', {
    count: offer.price,
    amount: offer.price.toLocaleString(locale),
  })
  return (
    <View style={styles.reach}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <OfferArt offer={offer} viewer={viewer} size={44} />
      </View>
      <View style={styles.flexText}>
        <Text style={styles.kickerMuted}>{t('storeHome.withinReach')}</Text>
        <Text style={styles.reachTitle} numberOfLines={1}>
          {offer.title}
        </Text>
        <View style={styles.reachLine}>
          <TokenAmount amount={offer.price} />
          <Text style={styles.muted}>
            {t('storeHome.leftAfter', { count: left, amount: left.toLocaleString(locale) })}
          </Text>
        </View>
      </View>
      <Button
        label={t('storeHome.buy')}
        accessibilityLabel={t('store.buyAccessibility', { title: offer.title, price })}
        icon={<TokenGlyph size={v3.icon.md} color={v3.colors.onYellow} />}
        loading={pending}
        onPress={onBuy}
        style={styles.reachBuy}
      />
    </View>
  )
}

/**
 * A cosmetic's picture: a frame on your own face, a title's tag on lilac, a
 * pack's first sticker on its paper.
 */
export function OfferArt({
  offer,
  viewer,
  size,
}: {
  offer: StoreOffer
  viewer: Viewer
  size: number
}) {
  const { v3 } = useTheme()
  const styles = useStyles()
  if (offer.kind === 'frame') {
    return (
      <Avatar
        url={viewer.avatarUrl}
        name={viewer.name}
        seed={viewer._id}
        size={size}
        frame={offer.tone}
      />
    )
  }
  return (
    <View
      style={[
        styles.square,
        {
          backgroundColor: offer.kind === 'title' ? v3.hues.lilac : v3.hues.sky,
          height: size,
          width: size,
        },
      ]}
    >
      {offer.kind === 'stickers' ? (
        <PackPicture pack={offer} />
      ) : (
        <Feather name="tag" size={v3.icon.lg} color={v3.colors.ink} />
      )}
    </View>
  )
}

/**
 * One of "Up next": a cosmetic you do not own yet, its kind or the rung that
 * opens it, and its price — dashed and with a lock while it is locked. The
 * whole tile is the one target: a frame opens its sheet, a title or a pack
 * its collection. It buys nothing itself, so nothing on it is yellow.
 */
export function UpNextTile({
  offer,
  viewer,
  onPress,
}: {
  offer: StoreOffer
  viewer: Viewer
  onPress: () => void
}) {
  const t = useT()
  const { locale } = useLocale()
  const { v3 } = useTheme()
  const styles = useStyles()
  const kind =
    offer.kind === 'frame'
      ? rarityLabel(t, frameRarity(offer.id))
      : offer.kind === 'title'
        ? t('store.titleKind')
        : t('store.stickerKind')
  const line = offer.needs ? t('storeHome.after', { title: offer.needs }) : kind
  const price = t('wallet.price', {
    count: offer.price,
    amount: offer.price.toLocaleString(locale),
  })
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        offer.needs
          ? t('storeHome.afterA11y', { title: offer.title, price, needs: offer.needs })
          : t('storeHome.tileA11y', { title: offer.title, price })
      }
      onPress={onPress}
      style={({ pressed }) => [styles.upNext, pressed && styles.tilePressed]}
    >
      <View
        style={styles.upNextArt}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <OfferArt offer={offer} viewer={viewer} size={40} />
      </View>
      <Text style={styles.tileTitle} numberOfLines={1}>
        {offer.title}
      </Text>
      <Text style={styles.mutedSmall} numberOfLines={2}>
        {line}
      </Text>
      <View style={styles.flex} />
      <View style={[styles.pricePill, offer.locked && styles.pricePillLocked]}>
        {offer.locked ? <Feather name="lock" size={v3.icon.xs} color={v3.colors.muted} /> : null}
        <TokenAmount amount={offer.price} muted={!!offer.locked} />
      </View>
    </Pressable>
  )
}

/** A collection's tile on its hue: Frames, Titles or Stickers, and how many are yours. */
export function CollectionTile({
  title,
  count,
  hue,
  art,
  onPress,
}: {
  title: string
  count: string
  hue: string
  art: ReactNode
  onPress: () => void
}) {
  const styles = useStyles()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${count}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.collection,
        { backgroundColor: hue },
        pressed && styles.pressed,
      ]}
    >
      <View
        style={styles.collectionArt}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {art}
      </View>
      <Text style={styles.collectionTitle} numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.collectionCount} numberOfLines={2}>
        {count}
      </Text>
    </Pressable>
  )
}

/**
 * One frame in the collection's grid: your face in it at 64, its name, and
 * its state — Owned, Wearing, its price, or its price behind a lock. Choosing
 * it moves the preview above; it buys nothing, so the footer's Buy is the
 * only yellow.
 */
export function FrameTile({
  offer,
  viewer,
  worn,
  selected,
  onPress,
}: {
  offer: StoreOffer
  viewer: Viewer
  worn: boolean
  selected: boolean
  onPress: () => void
}) {
  const t = useT()
  const { locale } = useLocale()
  const { v3 } = useTheme()
  const styles = useStyles()
  const rarity = rarityLabel(t, frameRarity(offer.id))
  const price = t('wallet.price', {
    count: offer.price,
    amount: offer.price.toLocaleString(locale),
  })
  const state = offer.owned
    ? worn
      ? t('store.wearing')
      : t('store.owned')
    : offer.locked
      ? `${price}, ${t('store.locked')}`
      : price
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${offer.title}, ${rarity}, ${state}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.frameTile,
        selected && { borderColor: v3.colors.blue },
        pressed && styles.tilePressed,
      ]}
    >
      <View
        style={styles.frameTileArt}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Avatar
          url={viewer.avatarUrl}
          name={viewer.name}
          seed={viewer._id}
          size={56}
          frame={offer.tone}
        />
      </View>
      <Text style={styles.frameTileName} numberOfLines={2}>
        {offer.title}
      </Text>
      {offer.owned ? (
        worn ? (
          <View style={styles.wearingChip}>
            <Feather name="check" size={v3.icon.xs} color={v3.colors.onBlue} />
            <Text style={styles.wearingText}>{t('store.wearing')}</Text>
          </View>
        ) : (
          <View style={styles.ownedLine}>
            <Feather name="check" size={v3.icon.xs} color={v3.colors.muted} />
            <Text style={styles.mutedSmall}>{t('store.owned')}</Text>
          </View>
        )
      ) : (
        <View style={styles.ownedLine}>
          {offer.locked ? <Feather name="lock" size={v3.icon.xs} color={v3.colors.muted} /> : null}
          <TokenAmount amount={offer.price} muted={offer.locked || !offer.affordable} />
        </View>
      )}
    </Pressable>
  )
}

/** A rarity's heading over its grid: the chip, and how many of it are yours. */
export function RarityHeading({ rarity, note }: { rarity: Rarity; note: string }) {
  const styles = useStyles()
  return (
    <View style={styles.rarityHead} accessibilityRole="header">
      <RarityChip rarity={rarity} />
      <Text style={styles.mutedSmall}>{note}</Text>
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  flex: { flex: 1 },
  flexText: { flex: 1, gap: v3.space[2], minWidth: 0 },
  pressed: { opacity: 0.85 },
  tilePressed: { backgroundColor: v3.colors.line },
  muted: { ...v3.type.caption, color: v3.colors.muted },
  mutedSmall: { ...v3.type.label, color: v3.colors.muted },

  amount: { alignItems: 'center', flexDirection: 'row', gap: v3.space[4] },
  amountText: { ...v3.type.buttonSmall, fontVariant: ['tabular-nums'] },

  rarity: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[6],
    minHeight: 26,
    paddingHorizontal: v3.space[10],
  },
  pips: { flexDirection: 'row', gap: v3.space[2] },
  pip: { borderRadius: 3, height: 6, transform: [{ rotate: '45deg' }], width: 6 },
  rarityText: { ...v3.type.label },
  rarityHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[8],
    justifyContent: 'space-between',
    paddingHorizontal: v3.space[2],
    paddingTop: v3.space[8],
  },

  heading: { ...v3.type.headline, color: v3.colors.fg },

  featuredRow: { marginHorizontal: -20 },
  featuredContent: { gap: v3.space[8], paddingHorizontal: 20 },
  featured: {
    borderRadius: v3.radius.block,
    borderWidth: 1,
    flexDirection: 'row',
    gap: v3.space[8],
    minHeight: 176,
    overflow: 'hidden',
    padding: v3.space[16],
    width: 330,
  },
  featuredText: { flex: 1, gap: v3.space[4], minWidth: 0 },
  kicker: { ...v3.type.label, letterSpacing: 0.6, textTransform: 'uppercase' },
  kickerMuted: {
    ...v3.type.label,
    color: v3.colors.muted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  featuredTitle: { ...v3.type.headline },
  featuredBody: { ...v3.type.caption },
  outlinePill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    justifyContent: 'center',
    marginTop: v3.space[8],
    minHeight: ICON_BUTTON_TARGET,
    paddingHorizontal: v3.space[16],
  },
  pillLabel: { ...v3.type.buttonSmall },
  featuredArt: { alignItems: 'center', gap: v3.space[8], justifyContent: 'center', width: 112 },
  gateMini: { alignSelf: 'stretch', gap: v3.space[4] },
  gateMiniRow: { alignItems: 'center', flexDirection: 'row', gap: v3.space[4] },
  gateMiniTrack: { borderRadius: 2, flex: 1, height: 4, overflow: 'hidden' },
  gateMiniFill: { height: 4 },
  gateMiniText: { ...v3.type.label, fontVariant: ['tabular-nums'] },
  packArt: { alignItems: 'center', justifyContent: 'center', width: 112 },
  packPicture: { height: 44, width: 44 },
  packTilt: { transform: [{ rotate: '6deg' }] },
  packTiltBack: { transform: [{ rotate: '-8deg' }] },

  reach: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    flexDirection: 'row',
    gap: v3.space[10],
    minHeight: 80,
    paddingEnd: v3.space[12],
    paddingStart: v3.space[10],
    paddingVertical: v3.space[12],
  },
  reachTitle: { ...v3.type.button, color: v3.colors.fg },
  reachLine: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[6] },
  reachBuy: { flexShrink: 0, width: 'auto' },

  square: { alignItems: 'center', borderRadius: v3.radius.icon, justifyContent: 'center' },

  upNext: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.card,
    gap: v3.space[2],
    minHeight: 176,
    padding: v3.space[10],
    width: 150,
  },
  upNextArt: { alignItems: 'center', height: 64, justifyContent: 'center' },
  tileTitle: { ...v3.type.button, color: v3.colors.fg },
  pricePill: {
    alignItems: 'center',
    borderColor: v3.colors.line,
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    flexDirection: 'row',
    gap: v3.space[4],
    justifyContent: 'center',
    marginTop: v3.space[8],
    minHeight: 40,
  },
  pricePillLocked: { borderStyle: 'dashed' },

  collection: {
    borderRadius: v3.radius.tile,
    flex: 1,
    minHeight: 150,
    overflow: 'hidden',
    paddingBottom: v3.space[10],
    paddingHorizontal: v3.space[10],
    paddingTop: v3.space[8],
  },
  collectionArt: { alignItems: 'center', height: 80, justifyContent: 'center' },
  collectionTitle: { ...v3.type.button, color: v3.colors.ink },
  collectionCount: { ...v3.type.label, color: v3.colors.ink },

  frameTile: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderColor: 'transparent',
    borderRadius: v3.radius.card,
    borderWidth: 2,
    flex: 1,
    gap: v3.space[4],
    minHeight: 44,
    minWidth: 0,
    paddingBottom: v3.space[10],
    paddingHorizontal: v3.space[4],
    paddingTop: v3.space[8],
  },
  frameTileArt: { alignItems: 'center', height: 80, justifyContent: 'center' },
  frameTileName: { ...v3.type.label, color: v3.colors.fg, textAlign: 'center' },
  ownedLine: { alignItems: 'center', flexDirection: 'row', gap: v3.space[4], minHeight: 24 },
  wearingChip: {
    alignItems: 'center',
    backgroundColor: v3.colors.blue,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[4],
    minHeight: 24,
    paddingHorizontal: v3.space[8],
  },
  wearingText: { ...v3.type.label, color: v3.colors.onBlue },
}))
