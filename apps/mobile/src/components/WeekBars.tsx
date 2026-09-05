import { Text, View } from 'react-native'
import type { Locale } from '@langx/shared'
import { makeStyles, useTheme } from '../lib/theme'
import { useLocale } from '../i18n'

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

/** v3's bar height; the ratio of a day against the week's peak scales into it. */
const BAR_AREA = 64
/** Days with nothing keep a visible stub, so the week still reads as seven days. */
const EMPTY_BAR = 8

interface WeekBarsProps {
  /** Seven days, oldest first. */
  days: { day: string; total: number }[]
  /** What the picture says, for a screen reader. */
  accessibilityLabel: string
}

/**
 * Seven days as seven rectangles, drawn with Views.
 *
 * No chart library: this is seven rectangles whose heights are a ratio, and
 * every library that draws it would either pull in `react-native-svg` or ship a
 * canvas shim to the web build. The header above it belongs to the caller —
 * the Me tab says "messages and corrections", the visitors page says
 * "visits" — which is why this is only the bars.
 */
export function WeekBars({ days, accessibilityLabel }: WeekBarsProps) {
  const { colors } = useTheme()
  const styles = useStyles()
  const { locale } = useLocale()

  // `|| 1` rather than a guard: an empty week divides by one and draws seven
  // empty stubs, which is the correct picture of a week with nothing in it.
  const peak = Math.max(...days.map((day) => day.total), 0) || 1

  return (
    <>
      <View style={styles.bars} accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
        {days.map((day) => (
          <View
            key={day.day}
            style={[
              styles.bar,
              day.total > 0
                ? {
                    backgroundColor: colors.accent,
                    height: Math.max(EMPTY_BAR, (day.total / peak) * BAR_AREA),
                  }
                : { backgroundColor: colors.fill, height: EMPTY_BAR },
            ]}
          />
        ))}
      </View>

      <View style={styles.labels}>
        {days.map((day) => (
          <Text key={day.day} style={styles.label}>
            {dayInitial(day.day, locale)}
          </Text>
        ))}
      </View>
    </>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  bars: { alignItems: 'flex-end', flexDirection: 'row', gap: 8, height: BAR_AREA, marginTop: 14 },
  bar: { borderRadius: 6, flex: 1 },
  labels: { flexDirection: 'row', gap: 8, marginTop: 8 },
  label: { color: colors.textFaint, flex: 1, fontSize: 11, fontWeight: '600', textAlign: 'center' },
}))
