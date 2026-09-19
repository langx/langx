import { Text, View } from 'react-native'
import { makeStyles, useTheme } from '../../lib/theme'

export interface BarListRow {
  key: string
  label: string
  value: number
  /** The line under the label — a conversion rate, a platform, a share. */
  hint?: string
}

interface BarListProps {
  rows: BarListRow[]
  /** Defaults to `accent`. One series, so one colour and no legend. */
  color?: string
  /**
   * What each bar is measured against. Defaults to the largest row, which is
   * what a ranked list wants; a funnel passes its first step, so every bar
   * reads as a share of the top rather than of the step above it.
   */
  scale?: number
  empty: string
}

/**
 * A ranked list where the row *is* the bar.
 *
 * Horizontal rather than columns because the labels are words — language
 * names, funnel steps, build numbers — and words under a column either rotate
 * or get cut. The fill sits behind the text at low opacity instead of beside
 * it, which keeps the row one line tall however many rows there are.
 *
 * The text stays in text tokens and never takes the series colour: the fill
 * behind it carries the identity, and a label painted in a chart hue is
 * illegible at the light end of any palette.
 */
export function BarList({ rows, color, scale, empty }: BarListProps) {
  const { colors } = useTheme()
  const styles = useStyles()

  const top = scale ?? Math.max(...rows.map((row) => row.value), 0)

  if (rows.length === 0) return <Text style={styles.empty}>{empty}</Text>

  return (
    <View style={styles.list}>
      {rows.map((row) => (
        <View
          key={row.key}
          style={styles.row}
          accessibilityRole="text"
          accessibilityLabel={`${row.label}: ${row.value}${row.hint ? `, ${row.hint}` : ''}`}
        >
          <View
            style={[
              styles.fill,
              {
                backgroundColor: color ?? colors.accent,
                // A row that counted nothing draws no fill at all rather than a
                // sliver, which would read as a small number instead of none.
                width: top > 0 ? `${(row.value / top) * 100}%` : '0%',
              },
            ]}
          />
          <View style={styles.text}>
            <Text numberOfLines={1} style={styles.label}>
              {row.label}
            </Text>
            {row.hint ? <Text style={styles.hint}>{row.hint}</Text> : null}
          </View>
          <Text style={styles.value}>{row.value.toLocaleString('en')}</Text>
        </View>
      ))}
    </View>
  )
}

const useStyles = makeStyles(({ colors, radius }) => ({
  list: { gap: 4 },
  row: {
    alignItems: 'center',
    borderRadius: radius.sm,
    flexDirection: 'row',
    gap: 12,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  /*
   * The hue at a wash rather than a tint token: `accentBg` is one fixed colour
   * and these rows have to take whichever hue the section is drawn in. Opacity
   * on the fill is what makes one colour work behind text in both schemes.
   */
  fill: { bottom: 0, left: 0, opacity: 0.16, position: 'absolute', top: 0 },
  text: { flex: 1, gap: 1 },
  label: { color: colors.text, fontSize: 14, fontWeight: '600' },
  hint: { color: colors.textMuted, fontSize: 12 },
  // Tabular: these are a column of numbers, and they have to line up.
  value: { color: colors.text, fontSize: 14, fontVariant: ['tabular-nums'], fontWeight: '700' },
  empty: { color: colors.textMuted, fontSize: 14 },
}))
