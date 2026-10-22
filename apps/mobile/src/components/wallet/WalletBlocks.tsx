import Feather from '@expo/vector-icons/Feather'
import { Image } from 'expo-image'
import { memo, useEffect, useRef, type ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useLocale, useT } from '../../i18n'
import type { StoreOffer } from '../../lib/storeOffers'
import { stickerAsset } from '../../lib/stickerAssets'
import { DISPLAY_FONT, makeStyles, useTheme } from '../../lib/theme'
import { DURATION, PRESS_SCALE_CARD, SPRING, TIMING, unlessReduced } from '../../lib/theme/motion'
import { tokenSlot } from '../../lib/tokenAmount'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { CountUp } from '../ui/CountUp'
import { ICON_BUTTON_TARGET, IconButton } from '../ui/IconButton'
import { PressableScale } from '../ui/PressableScale'
import { FlameGlyph } from '../ui/StreakFlame'
import { inkTrack, ProgressBar } from '../ui/ProgressBar'
import { TokenIcon, tokenMarkChildren, TokenText, useTokenIconMetrics } from '../ui/TokenIcon'

type Glyph = keyof typeof Feather.glyphMap

/*
 * The blocks of the redesign's wallet, its history and its store, drawn from
 * `V-Wallet`, `V-WalletHistory` and `V-WalletStore`. Dumb, as Home's and Me's
 * are: the screens decide what a block shows and hand it its words. The one
 * exception is `StoreRowV3`, which words its own lock and price the way
 * today's `StoreRow` does, so the two stores cannot describe an offer
 * differently.
 *
 * Tokens are points, not money: no coin, no card, no wallet-of-cash glyph
 * anywhere here. The balance is a number and the word "tokens".
 */

/** "›", pointing the way the line reads — mirrored for Arabic. */
function Chevron({ color }: { color: string }) {
  const { isRtl } = useLocale()
  const { v3 } = useTheme()
  return <Feather name={isRtl ? 'chevron-left' : 'chevron-right'} size={v3.icon.md} color={color} />
}

/**
 * The drawing's freeze: a six-armed mark, not Feather's `zap`. The bolt was
 * the current look's streak; v3's streak is a flame, and what keeps it is ice.
 */
export function FreezeGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {[
        'M12 3v18',
        'M4.2 7.5l15.6 9',
        'M19.8 7.5l-15.6 9',
        'M9.5 4.5 12 7l2.5-2.5',
        'M9.5 19.5 12 17l2.5 2.5',
      ].map((d) => (
        <Path
          key={d}
          d={d}
          stroke={color}
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  )
}

/**
 * Back on its own line and the title under it, as every wallet board draws
 * it; the store's balance rides at the end of the back row.
 */
export function WalletHeader({
  title,
  subtitle,
  balance,
  black,
  onBack,
}: {
  title: string
  subtitle?: string | undefined
  /**
   * "Balance 1,240 ✦", read as one: the store's chip. `value` carries the
   * token mark (`tokenSlot`); `a11y` says the unit in words.
   */
  balance?: { label: string; value: string; a11y: string } | undefined
  /** Whether Nunito Black has arrived; until then the title is ExtraBold. */
  black: boolean
  onBack: () => void
}) {
  const t = useT()
  const { isRtl } = useLocale()
  const { v3 } = useTheme()
  const styles = useStyles()
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <IconButton
          icon={isRtl ? 'chevron-right' : 'chevron-left'}
          accessibilityLabel={t('common.backPlain')}
          onPress={onBack}
        />
        {balance ? (
          <View style={styles.balanceChip} accessible accessibilityLabel={balance.a11y}>
            <Text style={styles.balanceChipLabel}>{balance.label}</Text>
            <Text style={styles.balanceChipValue}>
              {tokenMarkChildren(balance.value, styles.balanceChipValue.fontSize, v3.colors.fg)}
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.title, !black && styles.titleFallback]} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  )
}

export interface WalletHeroView {
  /** The block's ground: a partner hue, ink on top in both schemes. */
  ground: string
  kicker: string
  /**
   * The balance to show. When it changes the figure rolls from what it showed
   * to this over `DURATION.rise`, and bumps once if it went up. The screen
   * decides when to hand a new one over — not while the hero is out of sight.
   */
  value: number
  earnedSpent: string
  /**
   * The bar to the nearest frame or title, and the line that names it — with
   * the token mark in it (`tokenSentence`) and `label` saying it in words.
   */
  rung?: { line: string; label: string; fraction: number } | undefined
  history: string
  a11y: string
  onPress: () => void
  black: boolean
}

/**
 * The balance on its colour, and how far it is from the next rung.
 *
 * The whole block is the way into the ledger, as the balance is today — and
 * says so with the History pill in its corner. The pill is drawn, not a second
 * button: two targets inside one would be a block that does two things.
 *
 * The bar is ink on the hue, as Me's next badge draws it: the kit's
 * `ProgressBar` with an ink track, since its own grey all but disappears into
 * the hue after dark, where the fill and the track would both read as ink.
 */
export function WalletHero({ view }: { view: WalletHeroView }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const { locale } = useLocale()
  const reduce = useReduceMotion()

  // One bump when the balance goes up — the gift landing, a reward — and
  // nothing when it goes down: a spend is not an event to celebrate.
  const bump = useSharedValue(1)
  const last = useRef(view.value)
  useEffect(() => {
    const rose = view.value > last.current
    last.current = view.value
    if (!rose) return
    bump.set(
      unlessReduced(reduce, 1, (to) =>
        withSequence(withTiming(HERO_BUMP, TIMING.press), withSpring(to, SPRING.bounce)),
      ),
    )
  }, [view.value, reduce, bump])
  const bumpStyle = useAnimatedStyle(() => ({ transform: [{ scale: bump.get() }] }))
  // Capped where the figure caps its own growth (`maxFontSizeMultiplier` below).
  const heroIcon = useTokenIconMetrics(styles.numeral.fontSize, HERO_MAX_SCALE)

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={view.a11y}
      onPress={view.onPress}
      scaleTo={PRESS_SCALE_CARD}
      style={[styles.hero, { backgroundColor: view.ground }]}
    >
      {/* The pill shares the kicker's line rather than the totals', so the
          totals and the rung keep the block's whole width in every language. */}
      <View style={styles.heroHead}>
        <Text style={[styles.onHueKicker, styles.heroHeadText]}>{view.kicker}</Text>
        <View style={styles.inkPill}>
          <Text style={styles.inkPillLabel}>{view.history}</Text>
          <Chevron color={v3.colors.onBlue} />
        </View>
      </View>
      <View style={styles.figure}>
        <Animated.View style={[styles.numeralBox, bumpStyle]}>
          <CountUp
            value={view.value}
            from={view.value}
            locale={locale}
            reduce={reduce}
            duration={DURATION.rise}
            style={[styles.numeral, !view.black && styles.titleFallback]}
            numberOfLines={0}
            // A figure in a fixed block: at the largest text sizes six digits
            // would leave it. The unit beside it still scales in full.
            maxFontSizeMultiplier={HERO_MAX_SCALE}
          />
        </Animated.View>
        {/* The unit, as the token mark: on the figure's baseline, in its ink. */}
        <View style={{ transform: [{ translateY: heroIcon.drop }] }}>
          <TokenIcon size={heroIcon.size} color={v3.colors.ink} />
        </View>
      </View>
      <Text style={styles.onHueBody}>{view.earnedSpent}</Text>
      {view.rung ? (
        <View style={styles.rung}>
          <ProgressBar
            value={view.rung.fraction}
            height={12}
            fillColor={v3.colors.ink}
            trackColor={inkTrack(v3.colors.ink)}
            accessibilityLabel={view.rung.label}
          />
          <TokenText text={view.rung.line} label={view.rung.label} style={styles.onHueBody} />
        </View>
      ) : null}
    </PressableScale>
  )
}

/** How far the balance figure may grow with the reader's text size. */
const HERO_MAX_SCALE = 1.4

/** How far the balance swells on an increase before it lands on `SPRING.bounce`. */
const HERO_BUMP = 1.06

/**
 * The hourly gift as a big tile. Ready, it is the lilac block that opens it,
 * with Open drawn at its end; counting down, it is a grey block that only
 * says how long — not pressable, since the gift page sends anyone with
 * nothing to open straight back here.
 */
export function WalletGiftTile({
  title,
  status,
  open,
}: {
  title: string
  status: string
  /** Present when there is a gift to open. */
  open?: { label: string; a11y: string; hue: string; onPress: () => void } | undefined
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  if (!open) {
    return (
      <View style={[styles.gift, styles.giftWaiting]} accessible accessibilityRole="text">
        <View style={[styles.giftSquare, { backgroundColor: v3.colors.line }]}>
          <Feather name="gift" size={v3.icon.xl} color={v3.colors.fg} />
        </View>
        <View style={styles.flexText}>
          <Text style={styles.tileTitle}>{title}</Text>
          <Text style={styles.muted}>{status}</Text>
        </View>
      </View>
    )
  }
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={open.a11y}
      onPress={open.onPress}
      scaleTo={PRESS_SCALE_CARD}
      style={[styles.gift, { backgroundColor: open.hue }]}
    >
      <View style={[styles.giftSquare, { backgroundColor: v3.colors.ink }]}>
        <Feather name="gift" size={v3.icon.xl} color={open.hue} />
      </View>
      <View style={styles.flexText}>
        <Text style={[styles.tileTitle, { color: v3.colors.ink }]}>{title}</Text>
        <Text style={styles.onHueBody}>{status}</Text>
      </View>
      <View style={styles.inkPill}>
        <Text style={styles.inkPillLabel}>{open.label}</Text>
      </View>
    </PressableScale>
  )
}

/** "1 of 2 · Streak freezes": a count on the grey, with its glyph on a hue. */
export function WalletCountTile({
  glyph,
  hue,
  value,
  label,
  a11y,
  onPress,
}: {
  glyph: ReactNode
  hue: string
  value: string
  label: string
  a11y: string
  onPress: () => void
}) {
  const styles = useStyles()
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      scaleTo={PRESS_SCALE_CARD}
      touchStyle={styles.countTouch}
      style={styles.count}
    >
      <View style={[styles.square, { backgroundColor: hue }]}>{glyph}</View>
      <View style={styles.flexText}>
        <Text style={styles.tileTitle}>{value}</Text>
        <Text style={styles.muted}>{label}</Text>
      </View>
    </PressableScale>
  )
}

/** A day over its block: its UTC date, "Monday, October 19". */
export const HistoryHeading = memo(function HistoryHeading({ label }: { label: string }) {
  const styles = useStyles()
  return (
    <View style={styles.dayHead} accessibilityRole="header">
      <Text style={styles.dayLabel}>{label}</Text>
    </View>
  )
})

/**
 * One kind's total for a day. Memoised and flat — every prop a primitive —
 * because it is a row of a virtualised list: a page landing below must not
 * redraw the rows above it. No layout animation either (rule 13): rows are
 * recycled, and Reanimated's exiting and layout transitions crash on them.
 */
export const HistoryEntryRow = memo(function HistoryEntryRow({
  icon,
  hue,
  label,
  amount,
  amountLabel,
  spend,
  first,
  last,
}: {
  /** A Feather glyph, or `flame`: the streak's own drawing, which Feather has no glyph for. */
  icon: Glyph | 'flame'
  /** A partner hue for the square; the neutral grey when left out. */
  hue?: string | undefined
  label: string
  /** "+25 ✦", with the token mark (`tokenSlot`). */
  amount: string
  /** "+25 tokens": the amount as it is said. */
  amountLabel: string
  /** A spend is the one red on the page. */
  spend: boolean
  first: boolean
  last: boolean
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <View
      style={[
        styles.entry,
        first ? styles.entryFirst : styles.entryDivided,
        last && styles.entryLast,
      ]}
      accessible
      accessibilityLabel={`${label}, ${amountLabel}`}
    >
      <View style={[styles.entrySquare, { backgroundColor: hue ?? v3.colors.line }]}>
        {icon === 'flame' ? (
          <FlameGlyph size={v3.icon.md} color={hue ? v3.colors.ink : v3.colors.fg} />
        ) : (
          <Feather name={icon} size={v3.icon.md} color={hue ? v3.colors.ink : v3.colors.fg} />
        )}
      </View>
      <Text style={styles.entryLabel}>{label}</Text>
      <TokenText
        text={amount}
        label={amountLabel}
        style={[styles.entryAmount, spend && styles.entrySpend]}
      />
    </View>
  )
})

/** A store list's heading — "Sticker packs" — over its grey block. */
export function StoreSectionHead({ title }: { title: string }) {
  const styles = useStyles()
  return (
    <Text style={styles.sectionHead} accessibilityRole="header">
      {title}
    </Text>
  )
}

/** The grey block a group of store rows sits on. */
export function StoreGroup({ children }: { children: ReactNode }) {
  const styles = useStyles()
  return <View style={styles.group}>{children}</View>
}

interface StoreRowV3Props {
  offer: StoreOffer
  pending: boolean
  /** For the line a screen reader hears on a price the balance cannot cover. */
  balance: number
  /** The rows under the first draw the hairline above them. */
  first: boolean
  onBuy: (offer: StoreOffer) => void
  /** A sticker pack's or a title's square. */
  hue?: string | undefined
  /** For a frame: whose face wears it. */
  viewer?: { _id: string; name: string; avatarUrl?: string | undefined } | undefined
  /** Cosmetics only: whether this is the one being worn, and how to wear it instead. */
  equipped?: boolean | undefined
  onWear?: ((offer: StoreOffer) => void) | undefined
}

/**
 * One thing the balance buys, on v3's grey block: its picture, its name and
 * what it is, and at the end the large Buy — a `secondary` pill with the
 * price on it — or the row's state.
 *
 * Every row's Buy is the same outlined pill, never the yellow: each row buys
 * one thing, the purchase is confirmed by the toast it always was, and a
 * screen of yellow prices would be a screen with no primary at all.
 *
 * The price is the button, as today: "200 tokens" is the decision, and a
 * "Buy" beside a number would be two controls for it. A price the balance
 * cannot cover is the same pill, disabled, and tells a screen reader both
 * numbers. Owned, Wearing and Locked are states, not actions — a mark and a
 * word, never an outlined pill — and Wear, the one other thing a row can do,
 * is the quiet pill on the ground, so it never reads as a second purchase.
 */
export function StoreRowV3({
  offer,
  pending,
  balance,
  first,
  onBuy,
  hue,
  viewer,
  equipped = false,
  onWear,
}: StoreRowV3Props) {
  const t = useT()
  const { locale } = useLocale()
  const styles = useStyles()
  const { v3 } = useTheme()
  const buyable = !offer.owned && !offer.locked && offer.affordable && !pending

  // The same sentences `StoreRow` builds, so both stores say the same thing.
  const gateText = offer.requirement
    ? t(offer.requirement.kind === 'streak' ? 'store.lockedStreak' : 'store.lockedCorrections', {
        count: offer.requirement.threshold,
        current: offer.requirement.current.toLocaleString(locale),
        threshold: offer.requirement.threshold.toLocaleString(locale),
      })
    : null
  const subtitle = offer.locked
    ? offer.needs
      ? t('store.lockedNeeds', { title: offer.needs })
      : (gateText ?? offer.subtitle)
    : offer.subtitle

  const price = t('wallet.price', {
    count: offer.price,
    amount: offer.price.toLocaleString(locale),
  })
  // Short of tokens is the one disabled price worth explaining aloud. A full
  // bank of freezes is unbuyable too, but not for want of tokens, and its
  // line already says "2/2 banked".
  const short = !offer.owned && !offer.locked && balance < offer.price

  const end = offer.owned ? (
    offer.kind === 'stickers' || !onWear ? (
      <View
        style={styles.state}
        accessible
        accessibilityLabel={t('store.ownedAccessibility', { title: offer.title })}
      >
        <Feather name="check" size={v3.icon.sm} color={v3.colors.muted} />
        <Text style={styles.stateLabel}>{t('store.owned')}</Text>
      </View>
    ) : equipped ? (
      <View
        style={[styles.state, styles.wearing]}
        accessible
        accessibilityLabel={t('store.ownedAccessibility', { title: offer.title })}
        accessibilityState={{ selected: true }}
      >
        <Feather name="check" size={v3.icon.xs} color={v3.colors.echoText} />
        <Text style={[styles.stateLabel, { color: v3.colors.echoText }]}>{t('store.wearing')}</Text>
      </View>
    ) : (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('store.ownedAccessibility', { title: offer.title })}
        accessibilityHint={t('store.wear')}
        onPress={() => onWear(offer)}
        style={({ pressed }) => [styles.wear, pressed && styles.pressed]}
      >
        <Text style={styles.wearLabel}>{t('store.wear')}</Text>
      </Pressable>
    )
  ) : offer.locked ? (
    <View
      style={styles.state}
      accessible
      accessibilityLabel={t('store.lockedAccessibility', { title: offer.title })}
    >
      <Feather name="lock" size={v3.icon.sm} color={v3.colors.muted} />
      <Text style={styles.stateLabel}>{t('store.locked')}</Text>
    </View>
  ) : (
    <Button
      // "1,000 ✦": the number and the token mark, said in full below.
      label={tokenSlot(t, offer.price, locale)}
      accessibilityLabel={
        short
          ? t('store.notEnoughBody', {
              title: offer.title,
              price,
              balance: t('wallet.price', {
                count: balance,
                amount: balance.toLocaleString(locale),
              }),
            })
          : t('store.buyAccessibility', { title: offer.title, price })
      }
      variant="secondary"
      size="medium"
      disabled={!buyable}
      onPress={() => onBuy(offer)}
      style={styles.buy}
    />
  )

  const art =
    offer.kind === 'frame' && viewer ? (
      <Avatar
        url={viewer.avatarUrl}
        name={viewer.name}
        seed={viewer._id}
        size={ART}
        frame={offer.tone}
      />
    ) : (
      <View style={[styles.art, { backgroundColor: hue ?? v3.colors.line }]}>
        {offer.kind === 'stickers' ? (
          <StickerArt offer={offer} />
        ) : offer.kind === 'title' ? (
          <Feather name="tag" size={v3.icon.lg} color={hue ? v3.colors.ink : v3.colors.fg} />
        ) : offer.repairDay ? (
          <Feather name="calendar" size={v3.icon.lg} color={v3.colors.ink} />
        ) : (
          <FreezeGlyph size={v3.icon.lg} color={v3.colors.ink} />
        )}
      </View>
    )

  return (
    <View style={[styles.storeRow, !first && styles.storeRowDivided]}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.artSlot}
      >
        {art}
      </View>
      <View style={styles.flexText}>
        <Text style={styles.rowTitle}>{offer.title}</Text>
        {subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}
      </View>
      {end}
    </View>
  )
}

/** A pack's first picture, on its square — the pictures are the product. */
function StickerArt({ offer }: { offer: StoreOffer }) {
  const styles = useStyles()
  const first = offer.stickers?.[0]
  const picture = first ? stickerAsset(offer.id, first) : undefined
  return picture ? <Image source={picture} style={styles.sticker} contentFit="contain" /> : null
}

/** The leading picture's side: the drawing's 44, a frame's face included. */
const ART = 44

const useStyles = makeStyles(({ v3 }) => ({
  pressed: { opacity: 0.85 },
  flexText: { flex: 1, gap: v3.space[2], minWidth: 0 },
  muted: { ...v3.type.caption, color: v3.colors.muted },

  header: { gap: v3.space[2], paddingBottom: v3.space[6] },
  // The back glyph's own inset pulls it to the gutter, so the chevron and the
  // title under it start on one line.
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginStart: -v3.space[10],
  },
  title: { ...v3.type.title, color: v3.colors.fg },
  titleFallback: { fontFamily: DISPLAY_FONT },
  subtitle: { ...v3.type.callout, color: v3.colors.muted },
  balanceChip: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[6],
    minHeight: 36,
    paddingHorizontal: v3.space[14],
  },
  balanceChipLabel: { ...v3.type.caption, color: v3.colors.muted, fontWeight: '600' },
  balanceChipValue: { ...v3.type.buttonSmall, color: v3.colors.fg },

  hero: {
    borderRadius: v3.radius.block,
    gap: v3.space[6],
    paddingBottom: v3.space[16],
    paddingHorizontal: v3.space[16],
    paddingTop: v3.space[14],
  },
  onHueKicker: { ...v3.type.callout, color: v3.colors.ink, fontWeight: '700' },
  onHueBody: { ...v3.type.callout, color: v3.colors.ink, fontWeight: '600' },
  // Wraps, so a long balance pushes the unit under it rather than off the block.
  // On the baseline: the mark's box stands on the figure's, then drops a hair.
  figure: { alignItems: 'baseline', flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[8] },
  // The bump scales round the figure's own centre, not the block's.
  numeralBox: { flexShrink: 1 },
  numeral: { ...v3.type.numeral, color: v3.colors.ink, fontVariant: ['tabular-nums'] },
  rung: { gap: v3.space[6], paddingTop: v3.space[4] },
  heroHead: { alignItems: 'center', flexDirection: 'row', gap: v3.space[8] },
  heroHeadText: { flex: 1 },
  // Ink on the hue in both schemes, with the palette's one white that stays
  // white after dark — Home's chip, at a target's height.
  inkPill: {
    alignItems: 'center',
    backgroundColor: v3.colors.ink,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    flexShrink: 0,
    gap: v3.space[4],
    minHeight: 44,
    paddingHorizontal: v3.space[16],
  },
  inkPillLabel: { ...v3.type.buttonSmall, color: v3.colors.onBlue },

  gift: {
    alignItems: 'center',
    borderRadius: v3.radius.badge,
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 76,
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[12],
  },
  giftWaiting: { backgroundColor: v3.colors.surface },
  giftSquare: {
    alignItems: 'center',
    borderRadius: v3.radius.row,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  tileTitle: { ...v3.type.headline, color: v3.colors.fg },

  countTouch: { flex: 1 },
  count: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    flex: 1,
    flexDirection: 'row',
    gap: v3.space[10],
    minHeight: 64,
    padding: v3.space[12],
  },
  square: {
    alignItems: 'center',
    borderRadius: v3.radius.icon,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },

  dayHead: {
    alignItems: 'baseline',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: v3.space[8],
    paddingBottom: v3.space[6],
    paddingHorizontal: v3.space[6],
    paddingTop: v3.space[14],
  },
  dayLabel: { ...v3.type.headline, color: v3.colors.fg },
  entry: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 56,
    paddingEnd: v3.space[14],
    paddingStart: v3.space[12],
    paddingVertical: v3.space[8],
  },
  entryFirst: { borderTopEndRadius: v3.radius.tile, borderTopStartRadius: v3.radius.tile },
  entryLast: { borderBottomEndRadius: v3.radius.tile, borderBottomStartRadius: v3.radius.tile },
  entryDivided: { borderTopColor: v3.colors.line, borderTopWidth: 1 },
  entrySquare: {
    alignItems: 'center',
    borderRadius: v3.radius.icon,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  entryLabel: { ...v3.type.body, color: v3.colors.fg, flex: 1, fontWeight: '600' },
  entryAmount: { ...v3.type.headline, color: v3.colors.fg, fontVariant: ['tabular-nums'] },
  entrySpend: { color: v3.colors.danger },

  sectionHead: {
    ...v3.type.headline,
    color: v3.colors.fg,
    paddingBottom: v3.space[2],
    paddingHorizontal: v3.space[6],
    paddingTop: v3.space[14],
  },
  group: { backgroundColor: v3.colors.surface, borderRadius: v3.radius.tile, overflow: 'hidden' },
  storeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 70,
    paddingEnd: v3.space[10],
    paddingStart: v3.space[12],
    paddingVertical: v3.space[8],
  },
  storeRowDivided: { borderTopColor: v3.colors.line, borderTopWidth: 1 },
  artSlot: { alignItems: 'center', height: ART, justifyContent: 'center', width: ART },
  art: {
    alignItems: 'center',
    borderRadius: v3.radius.icon,
    height: ART,
    justifyContent: 'center',
    width: ART,
  },
  sticker: { height: 32, width: 32 },
  rowTitle: { ...v3.type.button, color: v3.colors.fg },
  buy: { flexShrink: 0, width: 'auto' },
  state: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    flexShrink: 0,
    gap: v3.space[4],
    minHeight: 40,
    paddingHorizontal: v3.space[8],
  },
  stateLabel: { ...v3.type.buttonSmall, color: v3.colors.muted },
  wearing: { backgroundColor: v3.colors.echoTint, paddingHorizontal: v3.space[12] },
  wear: {
    alignItems: 'center',
    backgroundColor: v3.colors.bg,
    borderRadius: v3.radius.pill,
    flexShrink: 0,
    justifyContent: 'center',
    minHeight: ICON_BUTTON_TARGET,
    paddingHorizontal: v3.space[16],
  },
  wearLabel: { ...v3.type.buttonSmall, color: v3.colors.fg },
}))
