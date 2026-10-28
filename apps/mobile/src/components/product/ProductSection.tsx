import type { ReactNode } from 'react'
import { View } from 'react-native'
import { PRODUCT_TEXT_SCALE } from '../../lib/productPage'
import { makeStyles } from '../../lib/theme'
import { BALANCED, useTextDirection } from './ProductGroup'
import { WordFitText } from './WordFitText'

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
  const direction = useTextDirection()
  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <WordFitText
          style={[styles.title, direction]}
          accessibilityRole="header"
          // Just short of the product's name over it and over the rows under
          // it, at every text size (`PRODUCT_TEXT_SCALE`).
          cap={PRODUCT_TEXT_SCALE.heading}
        >
          {title}
        </WordFitText>
        {intro ? (
          <WordFitText
            style={[styles.intro, direction, BALANCED]}
            cap={PRODUCT_TEXT_SCALE.text}
            textBreakStrategy="balanced"
            lineBreakStrategyIOS="push-out"
          >
            {intro}
          </WordFitText>
        ) : null}
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
