import Feather from '@expo/vector-icons/Feather'
import { Text, View } from 'react-native'
import type { EarnedBadge } from '../api/types'
import { makeStyles, useTheme } from '../lib/theme'
import { calloutColours } from './ui/Callout'

/** "Apr 2026" — a badge is dated to the month, not the minute. */
function earnedMonth(iso: string): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ''
  return at.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

/**
 * Each kind keeps the colour it has everywhere else: streaks are `warning` and
 * corrections are `success`, the same pairs the profile tiles and the chat
 * correction card use. A badge is a summary of those two facts, so inventing a
 * third palette for it would break the only thing making them legible at a
 * glance.
 */
function BadgeTile({ badge }: { badge: EarnedBadge }) {
  const { colors } = useTheme()
  const styles = useStyles()
  const pair = calloutColours(colors, badge.kind === 'streak' ? 'warning' : 'success')

  return (
    <View style={[styles.tile, !badge.earned && styles.locked]}>
      <View style={[styles.icon, { backgroundColor: badge.earned ? pair.bg : colors.bg }]}>
        {badge.kind === 'streak' ? (
          <Text style={styles.emoji}>🔥</Text>
        ) : (
          <Feather name="edit-3" size={18} color={badge.earned ? pair.fg : colors.textFaint} />
        )}
      </View>
      <Text style={styles.label}>{badge.label}</Text>
      <Text style={[styles.state, badge.earned && { color: pair.fg }]}>
        {badge.earned
          ? badge.earnedAt
            ? `Earned · ${earnedMonth(badge.earnedAt)}`
            : 'Earned'
          : 'Locked'}
      </Text>
    </View>
  )
}

export function BadgeGrid({ badges }: { badges: readonly EarnedBadge[] }) {
  const styles = useStyles()
  return (
    <View style={styles.grid}>
      {badges.map((badge) => (
        <BadgeTile key={badge.id} badge={badge} />
      ))}
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, radius }) => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  /**
   * Two per row on a phone. `48%` rather than a computed half: the gap is on
   * the container, so an exact 50% overflows by the gap and wraps every tile
   * onto its own line.
   */
  tile: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexGrow: 1,
    minWidth: '46%',
    padding: 14,
  },
  locked: { opacity: 0.45 },
  icon: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  emoji: { fontSize: 20 },
  label: { ...font.heading, color: colors.text, fontSize: 15, marginTop: 9 },
  state: {
    ...font.caption,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
}))
