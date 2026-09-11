import { shiftDayKey } from '@langx/shared'
import { useMemo, useRef, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { usePublicActivity, useActivity, useRepairDay, useWallet } from '../api/queries'
import {
  ACTIVITY_CELL_GAP,
  activityCellSize,
  activityGrid,
  type ActivityCell,
} from '../lib/activityMap'
import { Skeleton } from './ui/Skeleton'
import { confirmAndRepair } from '../lib/repairFlow'
import { makeStyles } from '../lib/theme'
import { useLocale, useT } from '../i18n'

/**
 * Twenty weeks: what fits across a phone at the 3px gutter without the map
 * having to scroll, and the number the legend's "weeks ago" reads from.
 */
const WEEKS = 20

/**
 * Every day this person showed up, and the ones they can still buy back.
 *
 * The grid is drawn from `streakDays` rather than from `dailyActivity`: the
 * streak's day is the user's local one and `dailyActivity` counts UTC days, so
 * shading the squares from the latter would slide the whole map by one for
 * anyone far enough east or west. One source, one meaning.
 */
export interface ActivityMapProps {
  /**
   * Somebody else's map. Read-only: no counts behind the shading, no repair —
   * buying back a day of a stranger's history is not a thing, and the endpoint
   * would refuse anyway.
   */
  handle?: string
}

export function ActivityMap({ handle }: ActivityMapProps = {}) {
  const styles = useStyles()
  const t = useT()
  const { locale } = useLocale()

  const to = new Date().toISOString().slice(0, 10)
  // Generous: the server clamps the range, and the grid only draws what it needs.
  const from = shiftDayKey(to, -(WEEKS + 1) * 7)
  const own = useActivity(from, to, !handle)
  const theirs = usePublicActivity(handle ?? '', from, to)
  const wallet = useWallet()
  const repair = useRepairDay()
  const scroller = useRef<ScrollView>(null)
  // Measured rather than assumed: the squares are sized to fill whatever width
  // the card actually has. See `activityCellSize` for why that is the knob.
  const [width, setWidth] = useState(0)
  const cell = activityCellSize(width, WEEKS)

  // One shape from two endpoints. The public one carries an intensity rather
  // than a count — the exact number is the private part — so it is turned back
  // into the count the shading came from.
  const source = handle ? theirs : own
  const columns = useMemo(() => {
    const data = handle ? theirs.data : own.data
    if (!data || (handle && theirs.data?.visible === false)) return []
    const days = handle
      ? new Map((theirs.data?.days ?? []).map((d) => [d.day, INTENSITY_ACTIONS[d.intensity] ?? 1]))
      : new Map((own.data?.days ?? []).map((d) => [d.day, d.actions]))
    return activityGrid({
      today:
        (handle ? theirs.data?.today : own.data?.today) ?? new Date().toISOString().slice(0, 10),
      weeks: WEEKS,
      days,
      maxAgeDays: own.data?.repair.maxAgeDays ?? 0,
      streak: (handle ? theirs.data?.streak : own.data?.streak) ?? undefined,
    })
  }, [handle, own.data, theirs.data])

  if (source.isPending)
    return (
      <View style={styles.loading}>
        {/* The grid's own height — seven rows and the gaps between them — so
            the screens around it do not shift when the squares arrive. */}
        <Skeleton height={cell * 7 + ACTIVITY_CELL_GAP * 6} />
      </View>
    )
  if (!source.data) return null
  // A profile that turned the map off says nothing at all, rather than showing
  // months of empty squares that look like an inactive person.
  if (handle && theirs.data?.visible === false) return null

  const rules = own.data?.repair ?? { price: 0, maxAgeDays: 0, perMonth: 0, usedThisMonth: 0 }
  const today = (handle ? theirs.data?.today : own.data?.today) ?? ''
  const days = handle ? [] : (own.data?.days ?? [])
  const filled = new Set(days.map((d) => d.day))
  const left = Math.max(0, rules.perMonth - rules.usedThisMonth)

  async function onPressDay(cell: ActivityCell): Promise<void> {
    if (handle || cell.state !== 'repairable') return
    await confirmAndRepair({
      day: cell.day,
      today,
      filled,
      price: rules.price,
      balance: wallet.data?.balance ?? 0,
      left,
      perMonth: rules.perMonth,
      t,
      locale,
      repair: (day, handlers) => repair.mutate(day, handlers),
    })
  }

  return (
    <View style={styles.wrap}>
      {/*
        Opened at the far end, because the grid runs oldest-first and the newest
        week is the one worth seeing. Left alone it opens on months ago, which
        is a calendar of nothing. `onContentSizeChange` rather than an effect:
        the offset only means anything once the columns have a width.
      */}
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.grid}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
      >
        {columns.map((column) => (
          <View key={column[0]?.day} style={styles.column}>
            {column.map((square) => (
              <Pressable
                key={square.day}
                accessibilityRole={square.state === 'repairable' ? 'button' : undefined}
                accessibilityLabel={
                  square.state === 'repairable'
                    ? t('activity.fillInDay', { day: square.day })
                    : undefined
                }
                disabled={Boolean(handle) || square.state !== 'repairable'}
                onPress={() => void onPressDay(square)}
                style={[
                  styles.cell,
                  { height: cell, width: cell },
                  square.state === 'future' && styles.future,
                  square.state === 'repairable' && styles.repairable,
                  square.intensity === 1 && styles.low,
                  square.intensity === 2 && styles.mid,
                  square.intensity >= 3 && styles.high,
                ]}
              />
            ))}
          </View>
        ))}
      </ScrollView>

      <View style={styles.legend}>
        <Text style={styles.legendText}>{t('activity.weeksAgo', { count: WEEKS })}</Text>
        {/* Only the owner can fill a day in, so only the owner is told a
            square can be tapped. */}
        {handle ? null : (
          <View style={styles.legendItem}>
            <View style={[styles.repairable, styles.legendSwatch]} />
            <Text style={styles.legendText}>{t('streak.legendMissed')}</Text>
          </View>
        )}
        <Text style={styles.legendText}>{t('day.today')}</Text>
      </View>
    </View>
  )
}

/**
 * The public map sends a bucket, not a count. Turning it back into the lowest
 * count in each bucket is enough to reproduce the same shade, and is the only
 * thing the grid needs from it.
 */
const INTENSITY_ACTIONS: Record<number, number> = { 1: 1, 2: 3, 3: 10, 4: 30 }

const useStyles = makeStyles(({ colors, spacing }) => ({
  loading: { paddingVertical: spacing.lg },
  // A v3 section, not a card: the screen's own padding is the edge.
  wrap: { paddingBottom: spacing.sm, paddingTop: spacing.lg },
  /**
   * `flexGrow` so the container fills the viewport when the grid is narrower
   * than it, which is what lets `justifyContent` centre the leftover. A grid
   * wider than the viewport is not shrunk by either, so a narrow phone still
   * scrolls.
   */
  grid: {
    flexDirection: 'row',
    flexGrow: 1,
    gap: ACTIVITY_CELL_GAP,
    justifyContent: 'center',
    paddingVertical: 6,
  },
  column: { gap: ACTIVITY_CELL_GAP },
  /**
   * `fill` is the square nothing is known about: a day before the repair
   * window, or before the account. An empty day must still be a visible square
   * on the white ground — a calendar whose empty days are invisible is not a
   * calendar, it is a scatter of dots.
   */
  cell: { backgroundColor: colors.fill, borderRadius: 3 },
  // Drawn as a gap rather than a square: a day that has not happened is not an
  // empty day.
  future: { backgroundColor: 'transparent' },
  // Red and dashed only while the day can still be bought back — the legend
  // ties this look to the tap, so a day past the window must not wear it.
  repairable: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.danger,
    borderStyle: 'dashed',
    borderWidth: 1,
  },
  // Three shades of work, the busiest in ink rather than a fourth blue: at
  // this size two more steps of the same hue stop being tellable apart.
  //
  // The lowest is the accent thinned out, not `accentBg`: that tint is a
  // near-match for `fill` in both schemes, so a quiet day read as a missed
  // one — a ten-day streak over a map with six squares showing.
  low: { backgroundColor: colors.accent, opacity: 0.4 },
  mid: { backgroundColor: colors.accent },
  high: { backgroundColor: colors.ink, opacity: 0.85 },
  legend: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 6,
  },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  legendSwatch: { borderRadius: 3, height: 10, width: 10 },
  legendText: { color: colors.textFaint, fontSize: 12 },
}))
