import { shiftDayKey } from '@langx/shared'
import { useMemo } from 'react'
import { Text, View } from 'react-native'
import { useActivity } from '../../../src/api/queries'
import { EmptyState } from '../../../src/components/ui/EmptyState'
import { Screen } from '../../../src/components/ui/Screen'
import { Skeleton } from '../../../src/components/ui/Skeleton'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { useLocale, useT } from '../../../src/i18n'
import { dayLabel } from '../../../src/lib/messageGroups'
import { goBackTo } from '../../../src/lib/navigation'
import { streakDayDetail, streakHistory } from '../../../src/lib/streakHistory'
import { makeStyles } from '../../../src/lib/theme'
import { usePullToRefresh } from '../../../src/hooks/usePullToRefresh'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { useV3HomeDecision } from '../../../src/hooks/useV3Home'
import { StreakHistoryScreenV3 } from '../../../src/screens/StreakHistoryScreenV3'

/** Enough to read as a history without becoming a year of scrolling. */
const DAYS = 60

/**
 * The streak's history — or, with `flags.v3Home` on, the redesign's
 * (`StreakHistoryScreenV3`), which brings the activity map back. Bare until
 * the config has said which, as the wallet's history is.
 */
export default function StreakHistoryRoute() {
  const v3Home = useV3HomeDecision()
  if (v3Home === undefined) return <Screen>{null}</Screen>
  return v3Home ? <StreakHistoryScreenV3 /> : <StreakHistoryScreen />
}

/**
 * The days behind the number on the profile.
 *
 * The activity map answers "how consistent, roughly" in a shape you take in at
 * a glance. This answers what the squares cannot: which day that was, when the
 * check-in happened, and which of them were bought. Same endpoint, same data —
 * a calendar and a list are not substitutes for one another.
 */
function StreakHistoryScreen() {
  useScreenInteractive()
  const t = useT()
  const { locale } = useLocale()
  const styles = useStyles()

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
        <ScreenHeader title={t('tokens.history')} onBack={() => goBackTo('/(app)/streak')} />
        <View>
          {SKELETON_ROWS.map((key) => (
            <View key={key} style={styles.row}>
              <Skeleton width={12} height={12} radius={3} />
              <Skeleton height={16} style={styles.daySkeleton} />
              <Skeleton width={68} height={14} />
            </View>
          ))}
        </View>
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
              {/* The square is the map's own, so a row and its cell read as
                  the same day: work in blue, a miss in the dashed square's
                  tint, a bought day in the shade a repair paints. */}
              <View
                style={[
                  styles.dot,
                  row.kind === 'missed'
                    ? styles.dotMissed
                    : row.kind === 'bought'
                      ? styles.dotBought
                      : styles.dotActive,
                ]}
              />
              <Text style={styles.day}>{dayLabel(row.day, { t, locale, now })}</Text>
              <Text
                style={[
                  styles.what,
                  row.kind === 'missed'
                    ? styles.whatMissed
                    : row.kind === 'bought'
                      ? styles.whatBought
                      : null,
                ]}
              >
                {streakDayDetail(t, locale, row)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Screen>
  )
}

const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e', 'f']

const useStyles = makeStyles(({ colors, spacing }) => ({
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.lg,
    paddingVertical: 14,
  },
  dot: { borderRadius: 3, height: 12, width: 12 },
  dotActive: { backgroundColor: colors.accent },
  dotMissed: { backgroundColor: colors.dangerBg },
  dotBought: { backgroundColor: colors.accentBg },
  day: { color: colors.text, flex: 1, fontSize: 16, fontWeight: '600' },
  daySkeleton: { flex: 1 },
  what: { color: colors.textMuted, fontSize: 14 },
  whatMissed: { color: colors.danger },
  whatBought: { color: colors.accent },
}))
