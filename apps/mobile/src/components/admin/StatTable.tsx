import { Text, View } from 'react-native'
import type { TableCell } from '../../lib/adminMeasure'
import { makeStyles } from '../../lib/theme'

export interface StatTableColumn {
  title: string
  /** Relative width; the first column is a label and takes more. */
  flex?: number
}

export interface StatTableRow {
  key: string
  cells: TableCell[]
}

interface StatTableProps {
  columns: StatTableColumn[]
  rows: StatTableRow[]
  /** A final row set apart from the rest, for the sum of the weeks above it. */
  total?: StatTableRow
  /** What the table is, for a screen reader that cannot see its columns. */
  accessibilityLabel: string
}

/**
 * Rows of figures, each with the line under it that says who it is out of.
 *
 * Drawn with Views because the data is a handful of columns of short strings
 * and a phone is narrow: a cell carries a rate over its denominator, which a
 * single-line grid would have to give up. No horizontal scroll — a table an
 * operator has to pan across is a table they read half of.
 *
 * Each row reads as one sentence to a screen reader (`column: figure, of
 * whom`), since the grid itself means nothing to it.
 */
export function StatTable({ columns, rows, total, accessibilityLabel }: StatTableProps) {
  const styles = useStyles()

  const spoken = (row: StatTableRow): string =>
    row.cells
      .map((cell, index) => {
        const title = columns[index]?.title ?? ''
        return `${title}: ${cell.main}${cell.sub ? `, ${cell.sub}` : ''}`
      })
      .join('. ')

  const renderRow = (row: StatTableRow, emphasis = false) => (
    <View
      key={row.key}
      style={[styles.row, emphasis && styles.total]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={spoken(row)}
    >
      {row.cells.map((cell, index) => (
        <View
          key={columns[index]?.title ?? index}
          style={[styles.cell, { flex: columns[index]?.flex ?? 1 }, index === 0 && styles.first]}
        >
          <Text style={[styles.main, index === 0 && styles.label, emphasis && styles.bold]}>
            {cell.main}
          </Text>
          {cell.sub ? <Text style={styles.sub}>{cell.sub}</Text> : null}
        </View>
      ))}
    </View>
  )

  return (
    <View accessibilityLabel={accessibilityLabel}>
      <View style={styles.head} accessibilityElementsHidden importantForAccessibility="no">
        {columns.map((column, index) => (
          <View
            key={column.title}
            style={[styles.cell, { flex: column.flex ?? 1 }, index === 0 && styles.first]}
          >
            <Text style={styles.title} numberOfLines={2}>
              {column.title}
            </Text>
          </View>
        ))}
      </View>
      {rows.map((row) => renderRow(row))}
      {total ? renderRow(total, true) : null}
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  head: {
    flexDirection: 'row',
    gap: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  total: { borderBottomWidth: 0, borderTopWidth: 1, borderTopColor: colors.text },
  cell: { alignItems: 'flex-end' },
  // The week label reads from the start; every figure aligns to its column's end.
  first: { alignItems: 'flex-start' },
  main: { color: colors.text, fontSize: 14, fontVariant: ['tabular-nums'] },
  label: { fontWeight: '600' },
  bold: { fontWeight: '700' },
  sub: { color: colors.textFaint, fontSize: 11, fontVariant: ['tabular-nums'] },
}))
