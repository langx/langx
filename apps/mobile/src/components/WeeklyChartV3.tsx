import type { TokenSummary } from '@langx/shared'
import { Text, View } from 'react-native'
import { useLocale, useT } from '../i18n'
import { makeStyles, useTheme } from '../lib/theme'
import { dayInitial } from './WeekBars'

/** The bars' own height inside the card, under which sit the day letters. */
const BAR_AREA = 72
/** A day that counted something never shrinks below this, however tall the peak. */
const MIN_BAR = 4
/** A day with nothing keeps a stub, so the week still reads as seven days. */
const EMPTY_BAR = 2

/**
 * Somebody's week in the redesign (`V-Profile`): a grey card of seven days,
 * messages in the person's colour beside corrections in green, and the legend
 * under it — the same numbers and the same words as `WeeklyChart`, side by
 * side rather than stacked, because the board draws them so.
 */
export function WeeklyChartV3({ week, hue }: { week: TokenSummary['week']; hue: string }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const { locale } = useLocale()

  const messages = week.reduce((sum, day) => sum + day.messages, 0)
  const corrections = week.reduce((sum, day) => sum + day.corrections, 0)
  // One scale for both series, so a quiet message day never outgrows a busy correction one.
  const peak = Math.max(...week.map((day) => Math.max(day.messages, day.corrections)), 0) || 1
  const height = (value: number) =>
    value > 0 ? Math.max(MIN_BAR, (value / peak) * BAR_AREA) : EMPTY_BAR

  return (
    <View style={styles.card}>
      <View
        style={styles.chart}
        accessibilityRole="image"
        accessibilityLabel={t('weekly.summary', {
          messages: t('format.messages', { count: messages }),
          corrections: t('format.corrections', { count: corrections }),
        })}
      >
        {week.map((day, index) => (
          <View key={day.day} style={styles.column}>
            <View style={styles.bars}>
              <View style={[styles.bar, { backgroundColor: hue, height: height(day.messages) }]} />
              <View
                style={[
                  styles.bar,
                  { backgroundColor: v3.colors.correction, height: height(day.corrections) },
                ]}
              />
            </View>
            {/* The week ends today, so the last letter is today's. */}
            <Text style={[styles.day, index === week.length - 1 && styles.today]}>
              {dayInitial(day.day, locale)}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: hue }]} />
          <Text style={styles.legendLabel}>{t('weekly.messages')}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: v3.colors.correction }]} />
          <Text style={styles.legendLabel}>{t('me.corrections')}</Text>
        </View>
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  card: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    gap: v3.space[10],
    paddingBottom: v3.space[12],
    paddingHorizontal: v3.space[14],
    paddingTop: v3.space[14],
  },
  chart: { alignItems: 'flex-end', flexDirection: 'row', gap: v3.space[8] },
  column: { alignItems: 'center', flex: 1, gap: v3.space[4] },
  bars: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 3,
    height: BAR_AREA,
    justifyContent: 'center',
  },
  bar: { borderRadius: 6, width: 12 },
  day: { ...v3.type.label, color: v3.colors.muted },
  today: { color: v3.colors.fg },
  legend: { flexDirection: 'row', gap: v3.space[16] },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: v3.space[6] },
  swatch: { borderRadius: 4, height: 12, width: 12 },
  legendLabel: { ...v3.type.caption, color: v3.colors.fg, fontWeight: '600' },
}))
