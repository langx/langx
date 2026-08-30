import { Text, View } from 'react-native'
import type { Locale, TokenSummary } from '@langx/shared'
import { makeStyles, useTheme } from '../lib/theme'
import { useLocale, useT } from '../i18n'

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

interface WeeklyChartProps {
  week: TokenSummary['week']
}

/** v3's bar height; the ratio of a day against the week's peak scales into it. */
const BAR_AREA = 64
/** Days with nothing keep a visible stub, so the week still reads as seven days. */
const EMPTY_BAR = 8

/**
 * Seven days, drawn with Views.
 *
 * No chart library: this is seven rectangles whose heights are a ratio, and
 * every library that draws it would either pull in `react-native-svg` or ship a
 * canvas shim to the web build. v3 merges the two v2 series into one bar per
 * day — messages and corrections summed — and lets the header line report the
 * two counts separately, so the legend went with the second series.
 */
export function WeeklyChart({ week }: WeeklyChartProps) {
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()
  const { locale } = useLocale()

  const messages = week.reduce((sum, day) => sum + day.messages, 0)
  const corrections = week.reduce((sum, day) => sum + day.corrections, 0)
  const totals = week.map((day) => day.messages + day.corrections)
  // `|| 1` rather than a guard: an empty week divides by one and draws seven
  // empty stubs, which is the correct picture of a week with nothing in it.
  const peak = Math.max(...totals, 0) || 1

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('weekly.thisWeek')}</Text>
        <Text style={styles.summary}>
          {t('store.todayCounts', {
            messages: t('format.messages', { count: messages }),
            corrections: t('format.corrections', { count: corrections }),
          })}
        </Text>
      </View>

      <View
        style={styles.bars}
        accessibilityRole="image"
        accessibilityLabel={t('weekly.summary', {
          messages: t('format.messages', { count: messages }),
          corrections: t('format.corrections', { count: corrections }),
        })}
      >
        {week.map((day, i) => {
          const total = totals[i] ?? 0
          return (
            <View
              key={day.day}
              style={[
                styles.bar,
                total > 0
                  ? {
                      backgroundColor: colors.accent,
                      height: Math.max(EMPTY_BAR, (total / peak) * BAR_AREA),
                    }
                  : { backgroundColor: colors.fill, height: EMPTY_BAR },
              ]}
            />
          )
        })}
      </View>

      <View style={styles.labels}>
        {week.map((day) => (
          <Text key={day.day} style={styles.label}>
            {dayInitial(day.day, locale)}
          </Text>
        ))}
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors, font }) => ({
  section: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingVertical: 18,
  },
  header: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
  title: { ...font.heading, color: colors.text, fontSize: 16 },
  summary: { color: colors.textMuted, fontSize: 13 },
  bars: { alignItems: 'flex-end', flexDirection: 'row', gap: 8, height: BAR_AREA, marginTop: 14 },
  bar: { borderRadius: 6, flex: 1 },
  labels: { flexDirection: 'row', gap: 8, marginTop: 8 },
  label: { color: colors.textFaint, flex: 1, fontSize: 11, fontWeight: '600', textAlign: 'center' },
}))
