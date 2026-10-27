import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { makeStyles } from '../../lib/theme'

/**
 * How far a section's heading grows with the reader's text size. At 2× it is
 * 44pt, the hero name's own size; at the largest sizes one word of a heading —
 * "Questions" — would be wider than a 375pt phone. The intro line under it
 * grows in full.
 */
const TITLE_MAX_SCALE = 2

/**
 * One section of a product page: a heading, a line on what it covers, and
 * the blocks under it.
 *
 * The heading is a header to a screen reader, so a person can move through a
 * long page section by section rather than block by block.
 */
export function ProductSection({
  title,
  intro,
  children,
}: {
  title: string
  /** A line under the heading, for a section whose blocks need a sentence of setup. */
  intro?: string
  children: ReactNode
}) {
  const styles = useStyles()
  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Text
          style={styles.title}
          accessibilityRole="header"
          maxFontSizeMultiplier={TITLE_MAX_SCALE}
        >
          {title}
        </Text>
        {intro ? <Text style={styles.intro}>{intro}</Text> : null}
      </View>
      {children}
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  section: { gap: v3.space[12] },
  // Indented by the blocks' own corner, so the heading starts where the text
  // inside the blocks starts rather than at their rounded edge.
  head: { gap: v3.space[4], paddingHorizontal: v3.space[6] },
  title: { ...v3.type.headline, color: v3.colors.fg },
  intro: { ...v3.type.callout, color: v3.colors.muted },
}))
