import Feather from '@expo/vector-icons/Feather'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { useMemo } from 'react'
import { Pressable, Text, View } from 'react-native'
import type { EarnedBadge } from '../api/types'
import type { BadgeSummary, Locale } from '@langx/shared'
import { BADGE_MARKS } from '../lib/badgeMark'
import { badgesEarnedFirst } from '../lib/badgeOrder'
import { makeStyles, useTheme } from '../lib/theme'
import { badgeLabel, useLocale, useT } from '../i18n'

/**
 * The catalogue's glyph, from whichever set it names. `mci:` in front means
 * MaterialCommunityIcons; everything else is Feather.
 *
 * The casts are the price of a name that arrives as data. Both libraries type
 * `name` as a union of their own glyphs and neither exports a runtime guard;
 * `badgeGlyph.test.ts` checks every name in `BADGES` against the shipped maps
 * instead, which catches the only thing the union would have.
 */
function BadgeGlyph({ icon, color }: { icon: string; color: string }) {
  if (icon.startsWith('mci:')) {
    const name = icon.slice(4) as React.ComponentProps<typeof MaterialCommunityIcons>['name']
    return <MaterialCommunityIcons name={name} size={22} color={color} />
  }
  return (
    <Feather name={icon as React.ComponentProps<typeof Feather>['name']} size={22} color={color} />
  )
}

/** "Apr 2026" — a badge is dated to the month, not the minute. */
function earnedMonth(iso: string, locale: Locale): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ''
  return at.toLocaleDateString(locale, { month: 'short', year: 'numeric' })
}

/**
 * One divided row per badge: the mark in a circle, the name, when it was
 * earned, and hard right either a green tick or how far along the next one is.
 *
 * The state still lives in the circle, and it is now the whole circle that
 * carries it: an earned badge wears its kind's colours, a locked one the plain
 * `fill` and a faint glyph. Colour is what earning it buys, so a locked row
 * never shows any — which also means one glance sorts the screen into what you
 * have and what you do not, without reading a word.
 *
 * Tiers inside a kind share a mark on purpose. Thirty days and a hundred days
 * are the same achievement at two sizes; a glyph each would only say so twice,
 * and the number in the label already says which rung. What differs is the
 * kind, because that is the thing a reader cannot infer.
 */
function BadgeRow({
  badge,
  next,
  onShare,
}: {
  badge: EarnedBadge
  next: BadgeSummary['next'] | undefined
  onShare?: ((label: string) => void) | undefined
}) {
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()
  const { locale } = useLocale()
  const label = badgeLabel({ t, locale }, badge.kind, badge.threshold)
  const mark = BADGE_MARKS[badge.kind](colors)

  /*
   * Only the nearest badge has a position on its own scale — `next.current`
   * is the one number the API works out — so the fraction sits on that row
   * and no other; the rest are simply not earned yet.
   */
  const fraction =
    !badge.earned && next && next.id === badge.id
      ? `${next.current.toLocaleString(locale)} / ${next.threshold.toLocaleString(locale)}`
      : null

  const content = (
    <>
      <View style={[styles.mark, { backgroundColor: badge.earned ? mark.fill : colors.fill }]}>
        <BadgeGlyph
          icon={badge.icon ?? 'award'}
          color={badge.earned ? mark.glyph : colors.textFaint}
        />
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.state}>
          {badge.earned
            ? badge.earnedAt
              ? t('badges.earned', { month: earnedMonth(badge.earnedAt, locale) })
              : t('badges.earnedLabel')
            : t('badges.locked')}
        </Text>
      </View>
      {badge.earned ? (
        <Feather name="check" size={18} color={colors.success} />
      ) : fraction ? (
        <Text style={styles.progress}>{fraction}</Text>
      ) : null}
    </>
  )

  /*
   * Earned rows are the only ones that press. A locked badge is a promise,
   * not a result, and "share the badge I do not have" is a sentence nobody
   * means; keeping the row inert also keeps the state honest — nothing
   * happens there yet.
   */
  if (!badge.earned || !onShare) {
    return <View style={styles.row}>{content}</View>
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('share.badge', { label })}
      onPress={() => onShare(label)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  )
}

export function BadgeGrid({
  badges,
  next,
  onShare,
}: {
  badges: readonly EarnedBadge[]
  /** The nearest unearned badge and where the reader stands on it, if the API knows. */
  next?: BadgeSummary['next']
  /** Given, an earned row opens the share sheet with its name. */
  onShare?: (label: string) => void
}) {
  // Earned first, always — see `badgesEarnedFirst` for why the catalogue's own
  // order is the wrong one here and what survives of it.
  const ordered = useMemo(() => badgesEarnedFirst(badges), [badges])

  return (
    <View>
      {ordered.map((badge) => (
        <BadgeRow key={badge.id} badge={badge} next={next} onShare={onShare} />
      ))}
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.lg,
    paddingVertical: spacing.lg,
  },
  pressed: { opacity: 0.7 },
  mark: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },

  body: { flex: 1, gap: 2 },
  name: { ...font.heading, color: colors.text, fontSize: 16 },
  state: { color: colors.textMuted, fontSize: 14 },
  progress: { color: colors.textFaint, fontSize: 13, fontWeight: '600' },
}))
