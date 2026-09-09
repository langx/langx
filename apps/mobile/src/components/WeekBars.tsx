import { Text, View } from 'react-native'
import type { Locale } from '@langx/shared'
import { makeStyles, useTheme } from '../lib/theme'
import { useLocale } from '../i18n'
import { Skeleton } from './ui/Skeleton'

/**
 * Monday-first initials. The API returns seven days ending today, so the
 * labels are derived from each row's own date rather than assumed — a week that
 * ends on Wednesday starts on Thursday, and a fixed `M T W T F S S` would lie.
 */
function dayInitial(day: string, locale: Locale): string {
  const at = new Date(`${day}T00:00:00Z`)
  if (Number.isNaN(at.getTime())) return ''
  // `narrow` is CLDR's own one-or-two-character weekday — "M" in English, "P"
  // in Turkish, "Д" in Russian. Hard-coding seven Latin initials put an English
  // week under a Russian chart.
  return new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' }).format(at)
}

/** v3's chart is 110 tall; this is what is left once the padding and the day letters are taken out. */
const BAR_AREA = 74
/** A day that counted something never shrinks below this, however tall the peak. */
const MIN_BAR = 4
/** Days with nothing keep a faint trace, so the week still reads as seven days. */
const EMPTY_BAR = 2

interface WeekBarsProps {
  /**
   * Seven days, oldest first. `total` is the blue bar; `stacked`, for a caller
   * with a second series, sits on top of it in green — the Me tab's
   * corrections over its messages. The visitors page has only the one.
   */
  days: { day: string; total: number; stacked?: number }[]
  /** What the picture says, for a screen reader. */
  accessibilityLabel: string
}

/**
 * Seven days as seven columns, drawn with Views.
 *
 * No chart library: this is a few rectangles whose heights are a ratio, and
 * every library that draws it would either pull in `react-native-svg` or ship a
 * canvas shim to the web build. Whatever sits above or below it belongs to the
 * caller — the Me tab adds a legend, the visitors page a "visits" header —
 * which is why this is only the bars.
 */
export function WeekBars({ days, accessibilityLabel }: WeekBarsProps) {
  const { colors } = useTheme()
  const styles = useStyles()
  const { locale } = useLocale()

  // Both series share one scale, so a stacked column can never outgrow the
  // area. `|| 1` rather than a guard: an empty week divides by one and draws
  // seven traces, which is the correct picture of a week with nothing in it.
  const peak = Math.max(...days.map((day) => day.total + (day.stacked ?? 0)), 0) || 1
  const barHeight = (value: number) => Math.max(MIN_BAR, (value / peak) * BAR_AREA)

  return (
    <View style={styles.chart} accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      {days.map((day, index) => (
        <View key={day.day} style={styles.column}>
          <View style={styles.bars}>
            {day.stacked ? (
              <View
                style={[
                  styles.bar,
                  { backgroundColor: colors.success, height: barHeight(day.stacked) },
                ]}
              />
            ) : null}
            <View
              style={[
                styles.bar,
                { backgroundColor: colors.accent },
                day.total > 0 ? { height: barHeight(day.total) } : styles.barEmpty,
              ]}
            />
          </View>
          {/* The week ends today, so the last letter is today's — the one drawn in ink. */}
          <Text style={[styles.label, index === days.length - 1 && styles.labelToday]}>
            {dayInitial(day.day, locale)}
          </Text>
        </View>
      ))}
    </View>
  )
}

/**
 * The chart before its week: same columns, same bar area, same label row, so
 * the real one drops into the slot without moving anything under it. The
 * heights are a fixed shape rather than random, so it does not flicker.
 */
export function WeekBarsSkeleton() {
  const styles = useStyles()
  return (
    <View style={styles.chart}>
      {SKELETON_BARS.map((height, index) => (
        <View key={index} style={styles.column}>
          <View style={styles.bars}>
            <Skeleton height={height} radius={4} />
          </View>
          <Skeleton width={9} height={13} />
        </View>
      ))}
    </View>
  )
}

const SKELETON_BARS = [28, 46, 20, 60, 36, 52, 24]

const useStyles = makeStyles(({ colors }) => ({
  chart: { alignItems: 'flex-end', flexDirection: 'row', gap: 10, paddingVertical: 8 },
  column: { alignItems: 'center', flex: 1, gap: 6 },
  bars: { alignSelf: 'stretch', gap: 2, height: BAR_AREA, justifyContent: 'flex-end' },
  bar: { borderRadius: 4 },
  barEmpty: { height: EMPTY_BAR, opacity: 0.3 },
  label: { color: colors.textFaint, fontSize: 11, fontWeight: '600' },
  labelToday: { color: colors.text },
}))
