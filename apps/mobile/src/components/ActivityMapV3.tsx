import { shiftDayKey } from '@langx/shared'
import { useMemo, useRef, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { usePublicActivity } from '../api/queries'
import { useT } from '../i18n'
import { ACTIVITY_CELL_GAP, activityCellSize, activityGrid } from '../lib/activityMap'
import { makeStyles, useTheme } from '../lib/theme'
import { INTENSITY_ACTIONS, WEEKS } from './ActivityMap'
import { Skeleton } from './ui/Skeleton'

/**
 * Somebody else's twenty weeks in the redesign (`V-Profile`): a grey card,
 * the days they showed up in their own colour on v3's track, today ringed.
 *
 * Read-only, as `ActivityMap` is for a `handle`: the same endpoint, the same
 * grid and the same silence when the person turned the map off. Only the
 * owner's map can repair a day, and the owner's map is not drawn here.
 */
export function ActivityMapV3({ handle, hue }: { handle: string; hue: string }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()

  const to = new Date().toISOString().slice(0, 10)
  const from = shiftDayKey(to, -(WEEKS + 1) * 7)
  const theirs = usePublicActivity(handle, from, to)
  const scroller = useRef<ScrollView>(null)
  const [width, setWidth] = useState(0)
  const cell = activityCellSize(width, WEEKS)

  const today = theirs.data?.today ?? to
  const columns = useMemo(() => {
    if (!theirs.data || theirs.data.visible === false) return []
    return activityGrid({
      today: theirs.data.today ?? new Date().toISOString().slice(0, 10),
      weeks: WEEKS,
      days: new Map(theirs.data.days.map((d) => [d.day, INTENSITY_ACTIONS[d.intensity] ?? 1])),
      maxAgeDays: 0,
      streak: theirs.data.streak ?? undefined,
    })
  }, [theirs.data])

  if (theirs.isPending)
    return (
      <View style={styles.card}>
        <Skeleton height={cell * 7 + ACTIVITY_CELL_GAP * 6} />
      </View>
    )
  // Turned off says nothing, rather than months of empty squares.
  if (!theirs.data || theirs.data.visible === false) return null

  return (
    <View style={styles.card}>
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
              <View
                key={square.day}
                style={[
                  styles.cell,
                  { height: cell, width: cell },
                  square.state === 'future' && styles.future,
                  square.intensity > 1 && { backgroundColor: hue },
                  // A quiet day is a ring of the hue around the card's own
                  // colour: a thinned fill all but vanished into the grey of
                  // an empty day on the pale hues. The shape tells it from
                  // empty whatever the hue; `profileChartColours.test.ts`
                  // measures the ring against the card.
                  square.intensity === 1 && [styles.quiet, { borderColor: hue }],
                  square.day === today && { borderColor: v3.colors.fg, borderWidth: 2 },
                ]}
              />
            ))}
          </View>
        ))}
      </ScrollView>
      <View style={styles.legend}>
        <Text style={styles.legendText}>{t('activity.weeksAgo', { count: WEEKS })}</Text>
        <Text style={styles.legendText}>{t('day.today')}</Text>
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  card: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    gap: v3.space[8],
    paddingBottom: v3.space[12],
    paddingHorizontal: v3.space[14],
    paddingTop: v3.space[14],
  },
  grid: {
    flexDirection: 'row',
    flexGrow: 1,
    gap: ACTIVITY_CELL_GAP,
    justifyContent: 'space-between',
  },
  column: { gap: ACTIVITY_CELL_GAP },
  cell: { backgroundColor: v3.colors.track, borderRadius: 3 },
  future: { backgroundColor: 'transparent' },
  quiet: { backgroundColor: v3.colors.surface, borderWidth: 2 },
  legend: { flexDirection: 'row', justifyContent: 'space-between' },
  legendText: { ...v3.type.caption, color: v3.colors.muted },
}))
