import { Text, View } from 'react-native'
import type { TokenSummary } from '@langx/shared'
import { makeStyles, useTheme } from '../lib/theme'
import { useT } from '../i18n'
import { HiddenFromOthers } from './HiddenFromOthers'
import { WeekBars, WeekBarsSkeleton } from './WeekBars'

interface WeeklyChartProps {
  /** Undefined while the summary loads: the slot is kept, the bars pulse. */
  week?: TokenSummary['week'] | undefined
  /**
   * The owner's own tab, with "Show my week chart" off: the chart is still
   * drawn — it is their data — and the legend says nobody else sees it.
   */
  hiddenFromOthers?: boolean
}

/**
 * This week's messages and corrections, one column per day.
 *
 * Two series stacked — corrections in green over messages in blue — with a
 * legend underneath rather than a header above: the counts are already on the
 * tiles, so all the chart has to say is which colour is which. The bars
 * themselves are `WeekBars`, shared with the visitors page.
 */
export function WeeklyChart({ week, hiddenFromOthers = false }: WeeklyChartProps) {
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()

  const messages = (week ?? []).reduce((sum, day) => sum + day.messages, 0)
  const corrections = (week ?? []).reduce((sum, day) => sum + day.corrections, 0)

  return (
    <View style={styles.section}>
      {week ? (
        <WeekBars
          days={week.map((day) => ({
            day: day.day,
            total: day.messages,
            stacked: day.corrections,
          }))}
          accessibilityLabel={t('weekly.summary', {
            messages: t('format.messages', { count: messages }),
            corrections: t('format.corrections', { count: corrections }),
          })}
        />
      ) : (
        <WeekBarsSkeleton />
      )}

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: colors.accent }]} />
          <Text style={styles.legendLabel}>{t('weekly.messages')}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: colors.success }]} />
          <Text style={styles.legendLabel}>{t('me.corrections')}</Text>
        </View>
        {hiddenFromOthers ? <HiddenFromOthers style={styles.hidden} /> : null}
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
  legend: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.lg,
    paddingBottom: spacing.sm,
  },
  // Hard right, where the legend's own items are not.
  hidden: { marginLeft: 'auto' },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  // 3, not a radius token: a 10px square on `sm` would already be a dot.
  swatch: { borderRadius: 3, height: 10, width: 10 },
  legendLabel: { color: colors.textMuted, fontSize: 12 },
}))
