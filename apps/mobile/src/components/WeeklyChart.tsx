import { Text, View } from 'react-native'
import type { TokenSummary } from '@langx/shared'
import { makeStyles } from '../lib/theme'
import { useT } from '../i18n'
import { WeekBars } from './WeekBars'

interface WeeklyChartProps {
  week: TokenSummary['week']
}

/**
 * This week's messages and corrections, one bar per day.
 *
 * v3 merges the two v2 series into one bar per day — messages and corrections
 * summed — and lets the header line report the two counts separately, so the
 * legend went with the second series. The bars themselves are `WeekBars`,
 * shared with the visitors page.
 */
export function WeeklyChart({ week }: WeeklyChartProps) {
  const styles = useStyles()
  const t = useT()

  const messages = week.reduce((sum, day) => sum + day.messages, 0)
  const corrections = week.reduce((sum, day) => sum + day.corrections, 0)

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

      <WeekBars
        days={week.map((day) => ({ day: day.day, total: day.messages + day.corrections }))}
        accessibilityLabel={t('weekly.summary', {
          messages: t('format.messages', { count: messages }),
          corrections: t('format.corrections', { count: corrections }),
        })}
      />
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
}))
