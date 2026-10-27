import { Children, isValidElement, type ReactNode } from 'react'
import { View } from 'react-native'
import { useLocale, useT } from '../../i18n'
import { goBackTo } from '../../lib/navigation'
import { makeStyles, useTheme } from '../../lib/theme'
import { Reveal } from '../paywall/Reveal'
import { IconButton } from '../ui/IconButton'
import { Screen } from '../ui/Screen'

/** Where back goes when the page was opened from a link, with no history behind it. */
const HOME = '/(app)/(tabs)/home'

/**
 * Past this many blocks the cascade stops growing. The rest of a page is below
 * the fold when it opens, and a block arriving a second after the page did
 * reads as one that was late, not as part of an entrance.
 */
const CASCADE = 4

/**
 * The frame the product pages share — Venus, Copilot, LangX Token and
 * Transparency (`docs/plans/products-and-transparency.md`, _One family_).
 *
 * Back, then the page's blocks, each rising in a beat after the one above
 * (`Reveal`, which reduce motion turns off). There is no title bar: the hero
 * carries the product's name, and a title above it would say it twice.
 *
 * Each child is one block. A page passes its hero, its sections, its
 * questions and its link out as siblings, and the space between them is
 * decided here, once, so the four pages cannot drift apart.
 */
export function ProductScreen({
  children,
  onRefresh,
  refreshing,
}: {
  children: ReactNode
  /** Pull-to-refresh, for a page whose numbers are live (`usePullToRefresh`). */
  onRefresh?: () => void
  refreshing?: boolean
}) {
  const t = useT()
  const { isRtl } = useLocale()
  const styles = useStyles()
  const { v3 } = useTheme()
  // `toArray` drops the `null` of a block a page chose not to draw, so the
  // cascade counts only what is on screen.
  const blocks = Children.toArray(children)

  return (
    <Screen
      scroll
      ground={v3.colors.bg}
      {...(onRefresh ? { onRefresh, refreshing: refreshing ?? false } : {})}
    >
      <View style={styles.header}>
        <IconButton
          icon={isRtl ? 'chevron-right' : 'chevron-left'}
          accessibilityLabel={t('common.backPlain')}
          onPress={() => goBackTo(HOME)}
        />
      </View>
      <View style={styles.stack}>
        {blocks.map((block, index) => (
          <Reveal key={isValidElement(block) ? block.key : index} index={Math.min(index, CASCADE)}>
            {block}
          </Reveal>
        ))}
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  // The glyph's own target hangs into the gutter, so the chevron lines up
  // with the hero's edge rather than sitting a target's padding inside it.
  header: { flexDirection: 'row', marginStart: -v3.space[10], paddingBottom: v3.space[6] },
  // The widest step on the scale. The sections have no boxes round them, so
  // this space is the only thing that ends one and starts the next; well
  // over a section's own row gap (20), it cannot be mistaken for another row.
  stack: { gap: v3.space[32], paddingBottom: v3.space[24] },
}))
