import { Text, View } from 'react-native'
import type { HistoryMapCell, HistoryMapState } from '../../lib/historyMap'
import { makeStyles } from '../../lib/theme'

/*
 * The redesign's activity map, drawn from `V-StreakHistory`: nine weeks of
 * squares on the grey block, the month over the column it begins in, and the
 * legend beside them. Dumb, like the streak screen's blocks — the screen
 * works out the squares (`historyMap`) and hands over every word.
 */

export interface HistoryMapLegendItem {
  state: Exclude<HistoryMapState, 'none' | 'future'>
  /** "Checked in" — the same words the row under the map uses. */
  label: string
  /** "Checked in: 40 days" — what a screen reader hears instead. */
  accessibilityLabel: string
}

/**
 * Not a button anywhere. The squares are 18pt, under any platform's minimum
 * target, so the day a repair can still reach is bought from the card under
 * the map rather than by tapping its square.
 *
 * To a screen reader the grid is one heading-like summary and the legend is
 * four lines, each with its count: 63 squares read one at a time would be a
 * minute of "image", and the list under the map already says every day by
 * name.
 */
export function HistoryMapBlock({
  columns,
  months,
  legend,
  accessibilityLabel,
}: {
  columns: readonly (readonly HistoryMapCell[])[]
  /** One per column: the month's short name, or null for no label. */
  months: readonly (string | null)[]
  legend: readonly HistoryMapLegendItem[]
  accessibilityLabel: string
}) {
  const styles = useStyles()
  return (
    <View style={styles.block}>
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={accessibilityLabel}
        style={styles.map}
      >
        {/* A row, so it runs from the reading edge: in Arabic the newest week
            is on the left, as the board's RTL note asks. */}
        <View style={styles.months} importantForAccessibility="no-hide-descendants">
          {columns.map((column, index) => (
            <View key={column[0]?.day ?? index} style={styles.monthSlot}>
              {months[index] ? (
                // No `numberOfLines`: on the web it caps the text at its 18pt
                // slot, which is the overflow the slot exists to allow.
                <Text style={styles.month}>{months[index]}</Text>
              ) : null}
            </View>
          ))}
        </View>
        <View style={styles.grid} importantForAccessibility="no-hide-descendants">
          {columns.map((column, index) => (
            <View key={column[0]?.day ?? index} style={styles.column}>
              {column.map((cell) => (
                <Square key={cell.day} cell={cell} />
              ))}
            </View>
          ))}
        </View>
      </View>
      <View style={styles.legend}>
        {legend.map((item) => (
          <View
            key={item.state}
            accessible
            accessibilityRole="text"
            accessibilityLabel={item.accessibilityLabel}
            style={styles.legendItem}
          >
            <View style={styles.swatch}>
              <DayPaint state={item.state} radius={4} />
            </View>
            <Text style={styles.legendText}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function Square({ cell }: { cell: HistoryMapCell }) {
  const styles = useStyles()
  return (
    <View style={styles.cell}>
      <DayPaint state={cell.state} />
      {/* Today wears a ring in full ink over whatever it is, so "this one"
          reads whether it is done yet or not. */}
      {cell.today ? <View style={styles.todayRing} /> : null}
    </View>
  )
}

/**
 * A square's paint, absolutely filling whatever holds it — the map's square,
 * the legend's swatch, the list's mark — so the three can never drift apart.
 *
 * "Opened the app" is the done tangerine thinned out and a miss is the red
 * thinned out under a softer red edge, rather than new colours: they are the
 * board's own tints of those two, and the kit has no token for either.
 */
export function DayPaint({
  state,
  radius = CORNER,
}: {
  state: HistoryMapState
  /** The holder's corner: the map's square, the legend's swatch, a row's mark. */
  radius?: number
}) {
  const styles = useStyles()
  const fill = [styles.fill, { borderRadius: radius }]
  switch (state) {
    case 'done':
      return <View style={[fill, styles.done]} />
    case 'opened':
      return <View style={[fill, styles.done, styles.thin]} />
    case 'bought':
      return <View style={[fill, styles.bought]} />
    case 'missed':
      return (
        <>
          <View style={[fill, styles.missedTint]} />
          <View style={[fill, styles.missedEdge]} />
        </>
      )
    case 'future':
      return <View style={[fill, styles.future]} />
    default:
      return <View style={[fill, styles.none]} />
  }
}

const CELL = 18
const GAP = 4
const CORNER = 5

const useStyles = makeStyles(({ v3 }) => ({
  /*
   * Wraps, so at large text the legend drops under the grid instead of
   * squeezing into a column one word wide.
   */
  block: {
    alignItems: 'flex-end',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.badge,
    columnGap: v3.space[14],
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingBottom: v3.space[14],
    paddingHorizontal: v3.space[14],
    paddingTop: v3.space[12],
    rowGap: v3.space[12],
  },
  map: { flexShrink: 0, gap: v3.space[6] },
  months: { flexDirection: 'row', gap: GAP },
  // The slot is a column wide and the name overflows it, as the board's do:
  // "Sep" over one 18pt column would not fit, over the empty ones after it does.
  monthSlot: { height: 16, overflow: 'visible', width: CELL },
  month: {
    ...v3.type.label,
    color: v3.colors.muted,
    position: 'absolute',
    start: 0,
    top: 0,
    width: CELL * 3 + GAP * 2,
  },
  grid: { flexDirection: 'row', gap: GAP },
  column: { gap: GAP },
  cell: { borderRadius: CORNER, height: CELL, overflow: 'hidden', width: CELL },
  fill: {
    bottom: 0,
    end: 0,
    position: 'absolute',
    start: 0,
    top: 0,
  },
  done: { backgroundColor: v3.hues.tangerine },
  thin: { opacity: 0.4 },
  bought: { backgroundColor: v3.hues.sky },
  missedTint: { backgroundColor: v3.colors.danger, opacity: 0.14 },
  missedEdge: { borderColor: v3.colors.danger, borderWidth: 2, opacity: 0.45 },
  // A day that has not happened is a gap with an outline, not an empty day.
  future: { borderColor: v3.colors.track, borderWidth: 2 },
  // Before the account's first day: nothing is known, so nothing is claimed.
  none: { backgroundColor: v3.colors.track },
  todayRing: {
    borderColor: v3.colors.fg,
    borderRadius: CORNER,
    borderWidth: 3,
    bottom: 0,
    end: 0,
    position: 'absolute',
    start: 0,
    top: 0,
  },
  legend: { flexBasis: 100, flexGrow: 1, gap: v3.space[8], minWidth: 100 },
  legendItem: { alignItems: 'flex-start', flexDirection: 'row', gap: v3.space[8] },
  swatch: {
    borderRadius: 4,
    height: 14,
    marginTop: 2,
    overflow: 'hidden',
    width: 14,
  },
  legendText: {
    ...v3.type.caption,
    color: v3.colors.fg,
    flex: 1,
    fontWeight: '600',
    lineHeight: 18,
  },
}))
