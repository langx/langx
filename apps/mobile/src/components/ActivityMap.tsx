import { shiftDayKey } from '@langx/shared'
import { useMemo, useRef } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { useActivity, useRepairDay, useWallet } from '../api/queries'
import { activityGrid, repairEffect, type ActivityCell } from '../lib/activityMap'
import { confirmAlert, showAlert } from '../lib/alert'
import { dayLabel } from '../lib/messageGroups'
import { makeStyles, useTheme } from '../lib/theme'
import { showToast } from '../lib/toast'

/** Half a year, which is as much as fits without the squares becoming dots. */
const WEEKS = 26

/**
 * Every day this person showed up, and the ones they can still buy back.
 *
 * The grid is drawn from `streakDays` rather than from `dailyActivity`: the
 * streak's day is the user's local one and `dailyActivity` counts UTC days, so
 * shading the squares from the latter would slide the whole map by one for
 * anyone far enough east or west. One source, one meaning.
 */
export function ActivityMap() {
  const { colors } = useTheme()
  const styles = useStyles()

  const to = new Date().toISOString().slice(0, 10)
  // Generous: the server clamps the range, and the grid only draws what it needs.
  const from = shiftDayKey(to, -(WEEKS + 1) * 7)
  const activity = useActivity(from, to)
  const wallet = useWallet()
  const repair = useRepairDay()
  const scroller = useRef<ScrollView>(null)

  const columns = useMemo(() => {
    if (!activity.data) return []
    return activityGrid({
      today: activity.data.today,
      weeks: WEEKS,
      days: new Map(activity.data.days.map((d) => [d.day, d.actions])),
      maxAgeDays: activity.data.repair.maxAgeDays,
    })
  }, [activity.data])

  if (activity.isPending) return <ActivityIndicator style={styles.loading} />
  if (!activity.data) return null

  const { repair: rules, today, days } = activity.data
  const filled = new Set(days.map((d) => d.day))
  const left = Math.max(0, rules.perMonth - rules.usedThisMonth)

  async function onPressDay(cell: ActivityCell): Promise<void> {
    if (cell.state !== 'repairable') return
    if (left === 0) {
      await showAlert('No repairs left', `You can fill in ${rules.perMonth} days a month.`)
      return
    }

    const effect = repairEffect({
      day: cell.day,
      today,
      filled,
      price: rules.price,
      balance: wallet.data?.balance ?? 0,
    })
    if (!effect.affordable) {
      await showAlert(
        'Not enough token',
        `Filling a day costs ${rules.price}. You have ${wallet.data?.balance ?? 0}.`,
      )
      return
    }

    /**
     * The whole point of the confirmation: it says what the purchase does
     * *before* it happens, including when the answer is "nothing much". A
     * square in the middle of a fortnight nobody was active in fills and joins
     * no streak, and saying so is worth more than the sale.
     */
    const label = dayLabel(cell.day, new Date(`${today}T12:00:00`))
    const streakLine = effect.changesStreak
      ? `Your streak goes from ${effect.streakBefore} to ${effect.streakAfter} days.`
      : 'It fills the square, but does not change your streak.'
    const confirmed = await confirmAlert({
      title: `Fill in ${label}?`,
      message: `${streakLine}\nYour balance goes ${wallet.data?.balance ?? 0} → ${effect.balanceAfter}.`,
      confirmLabel: 'Fill it in',
    })
    if (!confirmed) return

    repair.mutate(cell.day, {
      onSuccess: () => showToast('Day filled in'),
      onError: () => void showAlert('Could not fill that day', 'Try again in a moment.'),
    })
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title}>Activity</Text>
        <Text style={styles.hint}>
          {left > 0
            ? `${left} of ${rules.perMonth} repairs left · ${rules.price} tokens`
            : 'No repairs left this month'}
        </Text>
      </View>

      {/*
        Opened at the far end, because the grid runs oldest-first and the newest
        week is the one worth seeing. Left alone it opens on six months ago,
        which is a calendar of nothing. `onContentSizeChange` rather than an
        effect: the offset only means anything once the columns have a width.
      */}
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.grid}
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
      >
        {columns.map((column) => (
          <View key={column[0]?.day} style={styles.column}>
            {column.map((cell) => (
              <Pressable
                key={cell.day}
                accessibilityRole={cell.state === 'repairable' ? 'button' : undefined}
                accessibilityLabel={cell.state === 'repairable' ? `Fill in ${cell.day}` : undefined}
                disabled={cell.state !== 'repairable'}
                onPress={() => void onPressDay(cell)}
                style={[
                  styles.cell,
                  cell.state === 'future' && styles.future,
                  cell.state === 'repairable' && styles.repairable,
                  cell.intensity > 0 && {
                    backgroundColor: colors.streak,
                    opacity: 0.25 + cell.intensity * 0.1875,
                  },
                ]}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  loading: { paddingVertical: spacing.lg },
  wrap: { gap: spacing.sm },
  head: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
  title: { ...font.heading, color: colors.text, fontSize: 15 },
  hint: { ...font.caption, color: colors.textMuted },
  grid: { flexDirection: 'row', gap: 3, paddingVertical: spacing.xs },
  column: { gap: 3 },
  /**
   * `border`, not `surface`. The map sits on a card whose own background is
   * `surface`, so an empty square drawn in it disappears — and a calendar
   * whose empty days are invisible is not a calendar, it is a scatter of dots.
   * The gaps are half of what the grid is for.
   */
  cell: { backgroundColor: colors.border, borderRadius: 3, height: 13, width: 13 },
  // Drawn as a gap rather than a square: a day that has not happened is not an
  // empty day.
  future: { backgroundColor: 'transparent' },
  repairable: { borderColor: colors.border, borderStyle: 'dashed', borderWidth: 1 },
}))
