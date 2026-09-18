import Feather from '@expo/vector-icons/Feather'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { Pressable, Text, View } from 'react-native'
import type { EarnedBadge } from '../api/types'
import { isCohortBadge, type BadgeSummary, type Locale } from '@langx/shared'
import { makeStyles, useTheme } from '../lib/theme'
import { badgeLabel, useLocale, useT } from '../i18n'

/** "Apr 2026" — a badge is dated to the month, not the minute. */
function earnedMonth(iso: string, locale: Locale): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ''
  return at.toLocaleDateString(locale, { month: 'short', year: 'numeric' })
}

/**
 * One divided row per badge: the award mark in a circle, the name, when it
 * was earned, and hard right either a green tick or how far along the next
 * one is. The state lives in the circle — a warm fill for an earned badge, the
 * plain `fill` for one still to come — so the two differ in one place, and the
 * one mark serves every counting kind rather than a glyph per kind.
 *
 * The exception is a cohort badge, which gets its own mark: an ink circle and
 * a sprout. That rule above is about tiers on a ladder — thirty days and a
 * hundred days are the same achievement at two sizes, and a glyph each would
 * only say so twice. A cohort badge is not on anybody's ladder and cannot be
 * worked towards, and looking different is the whole of what it has to say.
 * There is no locked state to draw: `getBadgeSummary` never sends one to
 * somebody who has not got it.
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
      {isCohortBadge(badge.kind) ? (
        <View style={[styles.mark, styles.markCohort]}>
          <MaterialCommunityIcons name="sprout" size={22} color={colors.primary} />
        </View>
      ) : (
        <View style={[styles.mark, badge.earned ? styles.markEarned : styles.markLocked]}>
          <Feather name="award" size={22} color={badge.earned ? colors.streak : colors.textFaint} />
        </View>
      )}
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
  return (
    <View>
      {badges.map((badge) => (
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
  markEarned: { backgroundColor: colors.warningBg },
  markLocked: { backgroundColor: colors.fill },
  /**
   * Ink and the committing yellow — the one pairing in this palette that
   * appears nowhere else on the badges screen, which is the point. `primary`
   * is deliberately the same in both schemes, so the mark is the colour it was
   * given whatever the theme does; see `tokens.ts`.
   */
  markCohort: { backgroundColor: colors.ink },
  body: { flex: 1, gap: 2 },
  name: { ...font.heading, color: colors.text, fontSize: 16 },
  state: { color: colors.textMuted, fontSize: 14 },
  progress: { color: colors.textFaint, fontSize: 13, fontWeight: '600' },
}))
