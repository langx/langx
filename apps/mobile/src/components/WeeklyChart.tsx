import { Text, View } from 'react-native'
import type { TokenSummary } from '@langx/shared'
import { makeStyles, useTheme } from '../lib/theme'

/**
 * Monday-first initials. The API returns seven days ending today, so the
 * labels are derived from each row's own date rather than assumed — a week that
 * ends on Wednesday starts on Thursday, and a fixed `M T W T F S S` would lie.
 */
const DAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

interface WeeklyChartProps {
  week: TokenSummary['week']
}

/**
 * Two series over seven days, drawn with Views.
 *
 * No chart library: this is fourteen rectangles whose heights are a ratio, and
 * every library that draws it would either pull in `react-native-svg` or ship a
 * canvas shim to the web build. The one thing worth being careful about is the
 * scale — both series share a single maximum, because a chart that scaled each
 * series to its own height would show a quiet week and a busy one as identical.
 */
export function WeeklyChart({ week }: WeeklyChartProps) {
  const { colors } = useTheme()
  const styles = useStyles()

  const messages = week.reduce((sum, day) => sum + day.messages, 0)
  const corrections = week.reduce((sum, day) => sum + day.corrections, 0)
  // `|| 1` rather than a guard: an empty week divides by one and draws seven
  // zero-height bars, which is the correct picture of a week with nothing in it.
  const peak = Math.max(...week.flatMap((day) => [day.messages, day.corrections]), 0) || 1

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>This week</Text>
        <Text style={styles.summary}>
          {messages} messages · {corrections} corrections
        </Text>
      </View>

      <View
        style={styles.bars}
        accessibilityRole="image"
        accessibilityLabel={`This week: ${messages} messages and ${corrections} corrections.`}
      >
        {week.map((day) => (
          <View key={day.day} style={styles.column}>
            <View
              style={[
                styles.bar,
                { backgroundColor: colors.success, height: `${(day.corrections / peak) * 50}%` },
              ]}
            />
            <View
              style={[
                styles.bar,
                { backgroundColor: colors.accent, height: `${(day.messages / peak) * 50}%` },
              ]}
            />
          </View>
        ))}
      </View>

      <View style={styles.labels}>
        {week.map((day) => (
          <Text key={day.day} style={styles.label}>
            {DAY_INITIALS[new Date(`${day.day}T00:00:00Z`).getUTCDay()]}
          </Text>
        ))}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: colors.success }]} />
          <Text style={styles.legendLabel}>Corrections given</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: colors.accent }]} />
          <Text style={styles.legendLabel}>Messages</Text>
        </View>
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: { ...font.heading, color: colors.text, fontSize: 15 },
  summary: { ...font.caption, color: colors.textMuted },
  bars: { alignItems: 'flex-end', flexDirection: 'row', gap: 7, height: 78, marginTop: 14 },
  column: { flex: 1, gap: 3, height: '100%', justifyContent: 'flex-end' },
  bar: { borderRadius: radius.pill },
  labels: { flexDirection: 'row', marginTop: 7 },
  label: { ...font.caption, color: colors.textFaint, flex: 1, fontSize: 11, textAlign: 'center' },
  legend: { flexDirection: 'row', gap: spacing.lg, marginTop: 11 },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  dot: { borderRadius: radius.pill, height: 9, width: 9 },
  legendLabel: { ...font.caption, color: colors.textMuted, fontSize: 11, fontWeight: '600' },
}))
