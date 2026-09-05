import Feather from '@expo/vector-icons/Feather'
import { shiftDayKey } from '@langx/shared'
import { useMemo } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { useActivity } from '../../../src/api/queries'
import { EmptyState } from '../../../src/components/ui/EmptyState'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { useLocale, useT } from '../../../src/i18n'
import type { TranslateFn } from '../../../src/i18n/runtime'
import { dayLabel } from '../../../src/lib/messageGroups'
import { goBackTo } from '../../../src/lib/navigation'
import { streakHistory, type StreakHistoryRow } from '../../../src/lib/streakHistory'
import { makeStyles, useTheme } from '../../../src/lib/theme'
import { usePullToRefresh } from '../../../src/hooks/usePullToRefresh'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'

/** Enough to read as a history without becoming a year of scrolling. */
const DAYS = 60

/**
 * The days behind the number on the profile.
 *
 * The activity map answers "how consistent, roughly" in a shape you take in at
 * a glance. This answers what the squares cannot: which day that was, when the
 * check-in happened, and which of them were bought. Same endpoint, same data —
 * a calendar and a list are not substitutes for one another.
 */
export default function StreakHistoryScreen() {
  useScreenInteractive()
  const t = useT()
  const { locale } = useLocale()
  const styles = useStyles()
  const { colors } = useTheme()

  const to = new Date().toISOString().slice(0, 10)
  const from = shiftDayKey(to, -DAYS)
  const activity = useActivity(from, to)
  const pull = usePullToRefresh(() => activity.refetch())

  const rows = useMemo(
    () =>
      activity.data
        ? streakHistory({ today: activity.data.today, from, days: activity.data.days })
        : [],
    [activity.data, from],
  )

  if (activity.isPending) {
    return (
      <Screen>
        <ActivityIndicator style={styles.loading} />
      </Screen>
    )
  }

  const now = new Date(`${activity.data?.today ?? to}T12:00:00`)

  return (
    <Screen scroll {...pull}>
      <ScreenHeader title={t('tokens.history')} onBack={() => goBackTo('/(app)/streak')} />

      {rows.length === 0 ? (
        <EmptyState icon="calendar" title={t('streak.emptyTitle')} body={t('streak.emptyBody')} />
      ) : (
        <View>
          {rows.map((row) => (
            <View key={row.day} style={styles.row}>
              <Feather
                name={
                  row.kind === 'missed'
                    ? 'circle'
                    : row.kind === 'bought'
                      ? 'shopping-bag'
                      : row.kind === 'openedOnly'
                        ? // Held, not earned: an outline where a worked day is
                          // solid, so a run of them is visible at a glance.
                          'circle'
                        : 'check-circle'
                }
                size={18}
                color={
                  row.kind === 'missed'
                    ? colors.textFaint
                    : row.kind === 'bought'
                      ? colors.streak
                      : row.kind === 'openedOnly'
                        ? colors.textMuted
                        : colors.success
                }
              />
              <View style={styles.text}>
                <Text style={row.kind === 'missed' ? styles.dayMissed : styles.day}>
                  {dayLabel(row.day, { t, locale, now })}
                </Text>
                <Text style={styles.detail}>{detail(t, locale, row)}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </Screen>
  )
}

/**
 * The one line under each date.
 *
 * A bought day says so and shows no time, because it has none — stamping one
 * would be the screen inventing a check-in that never happened. A day recorded
 * before the field existed says the time is unknown for the same reason.
 */
function detail(t: TranslateFn, locale: string, row: StreakHistoryRow): string {
  if (row.kind === 'missed') return t('streak.missed')
  if (row.kind === 'bought') return t('streak.bought')
  if (row.kind === 'openedOnly') return t('streak.openedOnly')
  if (!row.firstAt) return t('streak.checkedInUnknownTime')
  const at = new Date(row.firstAt)
  if (Number.isNaN(at.getTime())) return t('streak.checkedInUnknownTime')
  return t('streak.checkedInAt', {
    time: at.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
    count: row.actions,
  })
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  loading: { marginTop: spacing.xxl },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: 14,
  },
  text: { flex: 1, gap: 2 },
  day: { ...font.label, color: colors.text, fontSize: 15 },
  // A missed day is still a row, but it is not news.
  dayMissed: { ...font.label, color: colors.textMuted, fontSize: 15 },
  detail: { ...font.caption, color: colors.textMuted },
}))
