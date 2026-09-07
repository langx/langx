import { Text, View } from 'react-native'
import type { TokenSummary } from '@langx/shared'
import { makeStyles, useTheme } from '../lib/theme'
import { useT } from '../i18n'
import { WeekBars } from './WeekBars'

interface WeeklyChartProps {
  week: TokenSummary['week']
}

/**
 * This week's messages and corrections, one column per day.
 *
 * Two series stacked — corrections in green over messages in blue — with a
 * legend underneath rather than a header above: the counts are already on the
 * tiles, so all the chart has to say is which colour is which. The bars
 * themselves are `WeekBars`, shared with the visitors page.
 */
export function WeeklyChart({ week }: WeeklyChartProps) {
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()

  const messages = week.reduce((sum, day) => sum + day.messages, 0)
  const corrections = week.reduce((sum, day) => sum + day.corrections, 0)

  return (
    <View style={styles.section}>
      <WeekBars
        days={week.map((day) => ({ day: day.day, total: day.messages, stacked: day.corrections }))}
        accessibilityLabel={t('weekly.summary', {
          messages: t('format.messages', { count: messages }),
          corrections: t('format.corrections', { count: corrections }),
        })}
      />

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: colors.accent }]} />
          <Text style={styles.legendLabel}>{t('weekly.messages')}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: colors.success }]} />
          <Text style={styles.legendLabel}>{t('me.corrections')}</Text>
        </View>
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors, spacing }) => ({
  section: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingBottom: spacing.sm,
    paddingTop: spacing.md,
  },
  legend: { flexDirection: 'row', gap: spacing.lg, paddingBottom: spacing.sm },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  // 3, not a radius token: a 10px square on `sm` would already be a dot.
  swatch: { borderRadius: 3, height: 10, width: 10 },
  legendLabel: { color: colors.textMuted, fontSize: 12 },
}))
