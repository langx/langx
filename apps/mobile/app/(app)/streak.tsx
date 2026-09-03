import Feather from '@expo/vector-icons/Feather'
import { shiftDayKey, STREAK_METRICS, type StreakMetric } from '@langx/shared'
import { useMemo, useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { useActivity, useMe, useStreakLeaderboard, useTokens } from '../../src/api/queries'
import { LeaderboardSection } from '../../src/components/LeaderboardSection'
import { Button } from '../../src/components/ui/Button'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { StatTile } from '../../src/components/ui/StatTile'
import { useLocale, useT } from '../../src/i18n'
import type { TranslateFn } from '../../src/i18n/runtime'
import { dayLabel } from '../../src/lib/messageGroups'
import { goBackTo } from '../../src/lib/navigation'
import { shareLink } from '../../src/lib/share'
import { streakShareText } from '../../src/lib/shareText'
import { streakHistory, type StreakHistoryRow } from '../../src/lib/streakHistory'
import { makeStyles, useTheme } from '../../src/lib/theme'

const STREAK_TABS: readonly StreakMetric[] = STREAK_METRICS

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
export default function StreakScreen() {
  const t = useT()
  const { locale } = useLocale()
  const styles = useStyles()
  const { colors } = useTheme()
  const tokens = useTokens()
  const me = useMe()
  const [metric, setMetric] = useState<StreakMetric>('current')
  const board = useStreakLeaderboard(metric)

  const to = new Date().toISOString().slice(0, 10)
  const from = shiftDayKey(to, -DAYS)
  const activity = useActivity(from, to)

  const rows = useMemo(
    () =>
      activity.data
        ? streakHistory({ today: activity.data.today, from, days: activity.data.days })
        : [],
    [activity.data, from],
  )

  if (activity.isPending) return <ActivityIndicator style={styles.loading} />

  const streak = tokens.data?.streak
  const now = new Date(`${activity.data?.today ?? to}T12:00:00`)

  return (
    <Screen scroll>
      <ScreenHeader title={t('streak.title')} onBack={() => goBackTo('/(app)/me')} />

      <View style={styles.tiles}>
        <StatTile label={t('me.dayStreak')} value={`🔥 ${streak?.current ?? 0}`} />
        <StatTile label={t('streak.longest')} value={String(streak?.longest ?? 0)} />
      </View>

      {/*
        Only once there is a number worth saying. A zero-day streak shared is
        an invitation to laugh, not to join — and the sentence carries the
        invite link, so it is that too.
      */}
      {streak && streak.current > 0 && me.data ? (
        <View style={styles.share}>
          <Button
            label={t('share.streak')}
            variant="secondary"
            onPress={() =>
              void shareLink(streakShareText(t, { count: streak.current, handle: me.data.handle }))
            }
          />
        </View>
      ) : null}

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

      {/*
        Below the history, because the history is why this page gets opened —
        the board is the answer to "how am I doing", which is the second
        question, not the first.
      */}
      <LeaderboardSection
        title={t('leaderboard.streakTitle')}
        options={STREAK_TABS.map((metric) => ({
          value: metric,
          label: t(
            metric === 'current' ? 'leaderboard.metricCurrent' : 'leaderboard.metricLongest',
          ),
        }))}
        selected={metric}
        onSelect={setMetric}
        pickerLabel={t('leaderboard.streakPicker')}
        entries={board.data?.entries ?? []}
        viewer={board.data?.viewer}
        valueOf={(row) => String((row as { streak?: number }).streak ?? 0)}
        viewerValue={String(board.data?.viewer.streak ?? 0)}
        loading={board.isPending}
        emptyTitle={t('leaderboard.streakEmptyTitle')}
        emptyBody={t('leaderboard.streakEmptyBody')}
        backTo="/(app)/streak"
      />
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
  loading: { paddingVertical: spacing.xl },
  share: { marginTop: spacing.md },
  tiles: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingBottom: 18,
    paddingTop: spacing.sm,
  },
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
