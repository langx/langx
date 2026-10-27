import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { makeStyles } from '../../lib/theme'

/**
 * One section of a product page: a heading, a line on what it covers, and
 * the rows under it.
 *
 * The rows sit on the ground, not in a grey block: on a page that is read top
 * to bottom, a box around every group is a frame around every paragraph, and
 * the space between sections already says where one ends.
 *
 * The heading is a header to a screen reader, so a person can move through a
 * long page section by section rather than row by row.
 */
export function ProductSection({
  title,
  intro,
  children,
}: {
  title: string
  /** A line under the heading, for a section whose rows need a sentence of setup. */
  intro?: string
  children: ReactNode
}) {
  const styles = useStyles()
  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {intro ? <Text style={styles.intro}>{intro}</Text> : null}
      </View>
      <View style={styles.rows}>{children}</View>
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  section: { gap: v3.space[16] },
  head: { gap: v3.space[4] },
  title: { ...v3.type.headline, color: v3.colors.fg },
  intro: { ...v3.type.callout, color: v3.colors.muted },
  // Wider than a row's own gap between its name and its line, so each row
  // reads as one thing without a rule between them.
  rows: { gap: v3.space[20] },
}))
