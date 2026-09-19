import { Text, View } from 'react-native'
import { makeStyles, useTheme } from '../../lib/theme'

export interface ColumnPoint {
  /** Unique within the series — a day key, a minute. */
  key: string
  /** `null` is a slot nobody recorded, which is not the same as zero. */
  value: number | null
  /** Drawn under the column. Leave out on a series too dense to label. */
  label?: string
}

interface ColumnsProps {
  points: ColumnPoint[]
  /** Defaults to `accent`. One series, so one colour and no legend. */
  color?: string
  /** The bar area, above the labels. */
  height?: number
  accessibilityLabel: string
}

/**
 * One series as columns, drawn with Views.
 *
 * `WeekBars` is the member-facing version of this and stays where it is: it
 * draws exactly seven days, stacks a second series, and labels its columns
 * with weekday initials in the reader's own locale. This one takes any number
 * of slots, carries no second series, and is read by an operator — so its
 * labels arrive as strings from the caller rather than being derived, and the
 * panel stays English without this file knowing that it does.
 *
 * A slot with no reading is a gap and draws nothing. A slot with a zero draws
 * the same hairline trace `WeekBars` uses. The two must not look alike: one
 * says nobody was counted, the other says nobody was there.
 */
export function Columns({ points, color, height = 72, accessibilityLabel }: ColumnsProps) {
  const { colors } = useTheme()
  const styles = useStyles()

  // `|| 1` rather than a guard: an empty series divides by one and draws its
  // traces, which is the correct picture of a window with nothing in it.
  const peak = Math.max(...points.map((point) => point.value ?? 0), 0) || 1

  return (
    <View accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <View style={[styles.plot, { height }]}>
        {points.map((point) => (
          <View key={point.key} style={styles.column}>
            {point.value === null ? null : (
              <View
                style={[
                  styles.bar,
                  { backgroundColor: color ?? colors.accent },
                  point.value > 0
                    ? // MIN_BAR: a slot that counted something never disappears,
                      // however tall the peak beside it.
                      { height: Math.max(4, (point.value / peak) * height) }
                    : styles.empty,
                ]}
              />
            )}
          </View>
        ))}
      </View>
      {/* The hairline the columns stand on — the only axis this chart has. */}
      <View style={styles.baseline} />
      {points.some((point) => point.label) ? (
        <View style={styles.labels}>
          {points.map((point, index) => (
            <View key={point.key} style={styles.column}>
              <Text
                numberOfLines={1}
                style={[styles.label, index === points.length - 1 && styles.labelLast]}
              >
                {point.label ?? ''}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  // 2px of ground between touching bars, which is what separates them — never
  // a border, which would add ink that is not data.
  plot: { alignItems: 'flex-end', flexDirection: 'row', gap: 2 },
  column: { alignItems: 'center', flex: 1 },
  // Rounded at the data end, square on the baseline it grows from.
  bar: { alignSelf: 'stretch', borderTopLeftRadius: 4, borderTopRightRadius: 4, maxWidth: 24 },
  empty: { height: 2, opacity: 0.3 },
  baseline: { backgroundColor: colors.border, height: 1, marginTop: 4 },
  labels: { flexDirection: 'row', gap: 2, marginTop: 6 },
  label: { color: colors.textFaint, fontSize: 10, fontWeight: '600' },
  /** The newest slot, in ink: every series here ends at now. */
  labelLast: { color: colors.text },
}))
