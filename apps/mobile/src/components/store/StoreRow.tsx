import Feather from '@expo/vector-icons/Feather'
import { Pressable, Text, View, type ViewStyle } from 'react-native'
import type { StoreOffer } from '../../lib/storeOffers'
import { useLocale, useT } from '../../i18n'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { makeStyles, useTheme } from '../../lib/theme'

interface StoreRowProps {
  offer: StoreOffer
  pending: boolean
  last?: boolean
  onBuy: (offer: StoreOffer) => void
  /** For the frame swatch: whose face wears it. */
  viewer?: { _id: string; name: string; avatarUrl?: string | undefined }
  /** Cosmetics only: whether this is the one being worn, and how to wear it instead. */
  equipped?: boolean
  onWear?: ((offer: StoreOffer) => void) | undefined
  /** The streak page tucks the freeze row under its own copy and needs the top gap shorter. */
  style?: ViewStyle
}

/**
 * One thing the balance buys. Owned items keep their row rather than
 * disappearing, so the catalogue stays the same shape whoever is looking at it.
 *
 * Three shapes from one offer. A consumable (the freeze, a repair) is a badge,
 * a sentence and a price. A frame is your own face wearing it — "Gold frame"
 * tells somebody the name of a thing they are being asked to spend eighteen
 * thousand token on; the swatch tells them what they are buying. A title is
 * the tag itself, since the tag *is* the product.
 *
 * The price *is* the button. A separate "Buy" beside a number would be two
 * controls for one decision, and the row has room for one.
 */
export function StoreRow({
  offer,
  pending,
  last = false,
  onBuy,
  viewer,
  equipped = false,
  onWear,
  style,
}: StoreRowProps) {
  const t = useT()
  const { locale } = useLocale()
  const styles = useStyles()
  const { colors } = useTheme()
  const buyable = !offer.owned && !offer.locked && offer.affordable && !pending

  /*
   * What the lock is waiting for, as a sentence. A gate says how far along you
   * are; a missing rung says which one to buy first. The gate's sentence is
   * short enough to be the button as well; the rung's is not, so that button
   * only says "Locked" and leaves the instruction to the line.
   */
  const gateText = offer.requirement
    ? t(offer.requirement.kind === 'streak' ? 'store.lockedStreak' : 'store.lockedCorrections', {
        count: offer.requirement.threshold,
        current: offer.requirement.current.toLocaleString(locale),
        threshold: offer.requirement.threshold.toLocaleString(locale),
      })
    : null
  const lockText = offer.needs
    ? t('store.lockedNeeds', { title: offer.needs })
    : (gateText ?? t('store.locked'))

  const lockLine = offer.locked ? (
    <View style={styles.lockRow}>
      <Feather name="lock" size={12} color={colors.textFaint} />
      <Text style={styles.lock}>{lockText}</Text>
    </View>
  ) : null

  const price = t('store.price', { count: offer.price })
  const buy = (
    <Button
      label={price}
      // The button says "200 tokens"; a screen reader needs to hear what for.
      accessibilityLabel={t('store.buyAccessibility', { title: offer.title, price })}
      variant="ink"
      size="small"
      disabled={!buyable}
      onPress={() => onBuy(offer)}
      style={{ width: 'auto' }}
    />
  )

  if (!offer.kind) {
    return (
      <View style={[styles.row, styles.rowItem, !last && styles.divided, style]}>
        <View style={styles.badge}>
          {/* The freeze is the bolt it protects; a repair is the day it reaches back for. */}
          <Feather name={offer.repairDay ? 'clock' : 'zap'} size={20} color={colors.accent} />
        </View>
        <View style={styles.text}>
          <Text style={styles.name}>{offer.title}</Text>
          <Text style={styles.meta}>{offer.subtitle}</Text>
        </View>
        {buy}
      </View>
    )
  }

  /*
   * Only the purchase is a `Button`. Wear, Wearing and Locked are drawn as
   * small pressables styled by hand because they are *states* of the row, not
   * actions the row offers: Wearing and Locked do nothing when pressed, and
   * Wear swaps a choice rather than committing anything. Giving them the
   * button's hard shadow would put three things that look like purchases on a
   * row that sells one.
   */
  const cta = offer.owned ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('store.ownedAccessibility', { title: offer.title })}
      accessibilityState={{ selected: equipped, disabled: equipped || !onWear }}
      disabled={equipped || !onWear}
      onPress={() => onWear?.(offer)}
      style={({ pressed }) => [
        styles.cta,
        equipped ? styles.ctaWearing : styles.ctaWear,
        pressed && !equipped && styles.pressed,
      ]}
    >
      <Text style={[styles.ctaLabel, { color: equipped ? colors.accent : colors.text }]}>
        {equipped ? t('store.wearing') : t('store.wear')}
      </Text>
    </Pressable>
  ) : offer.locked ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('store.lockedAccessibility', { title: offer.title })}
      accessibilityState={{ disabled: true }}
      disabled
      style={[styles.cta, styles.ctaLocked]}
    >
      <Text style={[styles.ctaLabel, { color: colors.textFaint }]}>
        {gateText ?? t('store.locked')}
      </Text>
    </Pressable>
  ) : (
    buy
  )

  if (offer.kind === 'title') {
    return (
      <View style={[styles.row, styles.rowCosmetic, !last && styles.divided, style]}>
        <View style={styles.tag}>
          <Text style={styles.tagLabel}>{offer.title}</Text>
        </View>
        <View style={styles.text}>{lockLine}</View>
        {cta}
      </View>
    )
  }

  return (
    <View style={[styles.row, styles.rowCosmetic, !last && styles.divided, style]}>
      {viewer ? (
        <Avatar
          url={viewer.avatarUrl}
          name={viewer.name}
          seed={viewer._id}
          size={40}
          frame={offer.tone}
        />
      ) : null}
      <View style={styles.text}>
        <Text style={styles.name}>{offer.title}</Text>
        {lockLine}
      </View>
      {cta}
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  // v3 rows run edge to edge of the screen's own padding, divided by hairlines.
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.lg },
  rowItem: { paddingVertical: spacing.lg },
  rowCosmetic: { paddingVertical: 14 },
  divided: { borderBottomColor: colors.border, borderBottomWidth: 1 },
  badge: {
    alignItems: 'center',
    backgroundColor: colors.accentBg,
    borderRadius: radius.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  text: { flex: 1, gap: 2 },
  name: { color: colors.text, fontSize: 16, fontWeight: '600' },
  meta: { color: colors.textMuted, fontSize: 13 },
  lockRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  lock: { color: colors.textFaint, fontSize: 13 },
  // The title as it is worn: an outlined tag beside a name, quiet on purpose.
  tag: {
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cta: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  ctaWear: { backgroundColor: colors.bg, borderColor: colors.border },
  ctaWearing: { backgroundColor: colors.accentBg, borderColor: 'transparent' },
  ctaLocked: { backgroundColor: colors.fill, borderColor: 'transparent' },
  ctaLabel: {
    fontFamily: font.heading.fontFamily,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  pressed: { opacity: 0.6 },
}))
