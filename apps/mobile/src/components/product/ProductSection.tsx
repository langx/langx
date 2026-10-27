import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { makeStyles } from '../../lib/theme'

/**
 * How far a section's heading grows with the reader's text size: to 44pt,
 * just short of the product's name over it (`ProductHero`, 48pt at most), so
 * at the largest sizes a heading never outgrows the page it divides. The
 * lines under it grow in full.
 */
const HEADING_MAX_SCALE = 2

/**
 * One section of a product page: a heading, a line on what it covers, and
 * the blocks under it — usually one `ProductGroup` of rows.
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
          maxFontSizeMultiplier={HEADING_MAX_SCALE}
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
  section: { gap: v3.space[8] },
  // Set in a little from the block's edge, as Settings sets its headings
  // (`SettingsHeadingV3`), so the heading starts clear of the block's
  // rounded corner rather than on it.
  head: { gap: v3.space[2], paddingHorizontal: v3.space[4] },
  title: { ...v3.type.headline, color: v3.colors.fg },
  intro: { ...v3.type.caption, color: v3.colors.muted },
}))
