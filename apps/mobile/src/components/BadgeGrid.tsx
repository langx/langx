import Feather from '@expo/vector-icons/Feather'
import { useMemo } from 'react'
import { Pressable, Text, View } from 'react-native'
import type { EarnedBadge } from '../api/types'
import type { BadgeSummary, Locale } from '@langx/shared'
import { BadgeMark } from './BadgeMark'
import { badgesEarnedFirst } from '../lib/badgeOrder'
import { makeStyles, useTheme } from '../lib/theme'
import { badgeLabel, useLocale, useT } from '../i18n'

/** "Apr 2026" — a badge is dated to the month, not the minute. */
function earnedMonth(iso: string, locale: Locale): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ''
  return at.toLocaleDateString(locale, { month: 'short', year: 'numeric' })
}

/**
 * One divided row per badge: the picture, the name, when it was earned, and
 * hard right either a green tick or how far along the next one is.
 *
 * The state lives in the picture, which is drawn faint until it is earned.
 * Colour is still what earning it buys, so one glance sorts the screen into
 * what you have and what you do not, without reading a word. There used to be
 * a filled circle doing that job around a glyph a whole ladder shared; the
 * picture is the mark now, and it is its own.
 *
 * Every rung has its own picture, and a ladder's are one idea growing — see
 * the art ladders in `@langx/shared`. The number in the label still says which
 * rung, and no longer has to say it alone.
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
      <BadgeMark icon={badge.icon} size={MARK_SIZE} locked={!badge.earned} />
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

/** The circle that held the glyph was 48 wide; the drawing keeps that rhythm. */
const MARK_SIZE = 40

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.lg,
    paddingVertical: spacing.lg,
  },
  pressed: { opacity: 0.7 },
  body: { flex: 1, gap: 2 },
  name: { ...font.heading, color: colors.text, fontSize: 16 },
  state: { color: colors.textMuted, fontSize: 14 },
  progress: { color: colors.textFaint, fontSize: 13, fontWeight: '600' },
}))
