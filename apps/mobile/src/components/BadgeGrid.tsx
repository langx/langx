import Feather from '@expo/vector-icons/Feather'
import { Text, View } from 'react-native'
import type { EarnedBadge } from '../api/types'
import type { Locale } from '@langx/shared'
import { makeStyles, useTheme } from '../lib/theme'
import { badgeLabel, useLocale, useT } from '../i18n'

/** "Apr 2026" — a badge is dated to the month, not the minute. */
function earnedMonth(iso: string, locale: Locale): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ''
  return at.toLocaleDateString(locale, { month: 'short', year: 'numeric' })
}

/**
 * One divided row per badge: the mark in a fixed slot, the name, and the
 * earned/locked state hard right. Green is the only colour — it already means
 * "earned" everywhere else (corrections, online dots), and a locked row fades
 * as a whole rather than recolouring, so the two states differ in exactly one
 * way each.
 */
function BadgeRow({ badge }: { badge: EarnedBadge }) {
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()
  const { locale } = useLocale()

  return (
    <View style={[styles.row, !badge.earned && styles.locked]}>
      <View style={styles.slot}>
        {badge.kind === 'streak' ? (
          <Text style={styles.emoji}>🔥</Text>
        ) : (
          <Feather
            name="check"
            size={22}
            color={badge.earned ? colors.success : colors.textFaint}
          />
        )}
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {badgeLabel({ t, locale }, badge.kind, badge.threshold)}
      </Text>
      <Text style={[styles.state, badge.earned && styles.stateEarned]}>
        {badge.earned
          ? badge.earnedAt
            ? t('badges.earned', { month: earnedMonth(badge.earnedAt, locale) })
            : t('badges.earnedLabel')
          : t('badges.locked')}
      </Text>
    </View>
  )
}

export function BadgeGrid({ badges }: { badges: readonly EarnedBadge[] }) {
  return (
    <View>
      {badges.map((badge) => (
        <BadgeRow key={badge.id} badge={badge} />
      ))}
    </View>
  )
}

const useStyles = makeStyles(({ colors, font }) => ({
  // Every row keeps its divider — the leaderboard section follows the list,
  // so even the last badge sits above a hairline in the design.
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 17,
  },
  locked: { opacity: 0.45 },
  slot: { alignItems: 'flex-start', width: 32 },
  emoji: { fontSize: 22 },
  name: { ...font.body, color: colors.text, flex: 1, fontSize: 16, fontWeight: '600' },
  state: { ...font.label, color: colors.textMuted },
  stateEarned: { color: colors.success },
}))
