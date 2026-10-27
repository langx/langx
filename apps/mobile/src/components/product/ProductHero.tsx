import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import type Feather from '@expo/vector-icons/Feather'
import { useFonts } from 'expo-font'
import { Text, View } from 'react-native'
import { DISPLAY_FONT, makeStyles } from '../../lib/theme'
import { Button } from '../ui/Button'
import { useStacked } from './ProductGroup'
import { ProductMark, type ProductMarkName } from './ProductMark'
import type { ProductTone } from './tone'

type Glyph = keyof typeof Feather.glyphMap

/**
 * How far the product's name grows with the reader's text size. iOS grows
 * its own titles less than body text at the largest sizes, for the same
 * reason: a word already this big is legible. "Transparency" in the title
 * face is about 206pt wide at 1×, so 1.5× still fits a 375pt phone's column
 * whole; at 2× it ran past the column and broke in the middle of the word.
 * The lines under it grow in full.
 */
const TITLE_MAX_SCALE = 1.5

/**
 * The action's label stops at 2×. At the largest size "introduction" alone
 * is wider than the pill on a 375pt phone and breaks in the middle; at 2× it
 * fits whole. A longer word — a German compound — still breaks, inside the
 * pill rather than past it (`Button`).
 */
const ACTION_MAX_SCALE = 2

/** The mark's tile. Not text, so it keeps its size whatever the reader's text size. */
const MARK = 64

interface ProductHeroProps {
  tone: ProductTone
  /** The product's own mark (`ProductMark`): LangX Token's spark, Copilot's chip, Venus's face. */
  mark: ProductMarkName
  /** The product's name. The page's heading, so it is read first. */
  title: string
  /** One line on what it is. */
  body: string
  /**
   * Two or three short facts, set side by side under the header: "In-app
   * points", "Can't be bought", "Can't be traded". Each one a fact, never a
   * slogan, and short enough to sit in a third of the phone.
   */
  facts?: readonly string[]
  /** A quieter line under the body: "Part of Pro", "Updated 4 minutes ago". */
  note?: string
  /**
   * The page's one action, under the name as a store listing has its button.
   * Blue: it opens something and commits to nothing, and the yellow stays
   * free for the screen it leads to.
   */
  action?: { label: string; onPress: () => void; icon?: Glyph }
}

/**
 * The top of every product page: the product's mark beside its name, the
 * way an app stands in a store listing, and its facts in one short strip.
 *
 * Compact on purpose. The page is a reference a person scrolls with a thumb,
 * so its top says what the product is in the first screen and leaves the
 * rest of that screen to the rows under it. The product's colour is on its
 * mark and on its rows' squares, never a block of its own.
 */
export function ProductHero({ tone, mark, title, body, facts, note, action }: ProductHeroProps) {
  const styles = useStyles()
  // Past the larger text sizes the mark goes above the name and the facts
  // become a list (`useStacked`).
  const stacked = useStacked()
  // Loaded here rather than at the root, as every screen that draws it does:
  // a cold start should not wait for a face most launches never show.
  const [black] = useFonts({ Nunito_900Black })

  return (
    <View style={styles.hero}>
      <View style={[styles.header, !stacked && styles.headerBeside]}>
        <ProductMark tone={tone} mark={mark} size={MARK} />
        <View style={[styles.words, !stacked && styles.wordsBeside]}>
          <Text
            style={[styles.title, !black && styles.titleFallback]}
            accessibilityRole="header"
            maxFontSizeMultiplier={TITLE_MAX_SCALE}
          >
            {title}
          </Text>
          <Text style={styles.body}>{body}</Text>
          {note ? <Text style={styles.note}>{note}</Text> : null}
          {action ? (
            <View style={styles.action}>
              <Button
                label={action.label}
                variant="blue"
                size="small"
                {...(action.icon ? { icon: action.icon } : {})}
                maxFontSizeMultiplier={ACTION_MAX_SCALE}
                onPress={action.onPress}
                style={styles.actionButton}
              />
            </View>
          ) : null}
        </View>
      </View>
      {facts && facts.length > 0 ? <Facts facts={facts} stacked={stacked} /> : null}
    </View>
  )
}

/**
 * The facts as a store listing's strip of figures: equal cells on the page's
 * own ground between two hairlines, a short rule between cells. Not on a grey
 * block — a band of grey cells is how a segmented control looks, and these
 * are statements, not choices. Read as one item — "In-app points, Can't be
 * bought, Can't be traded" — since the cells are one statement in parts.
 */
function Facts({ facts, stacked }: { facts: readonly string[]; stacked: boolean }) {
  const styles = useStyles()
  return (
    <View
      style={[styles.facts, !stacked && styles.factsBeside]}
      accessible
      accessibilityLabel={facts.join(', ')}
    >
      {facts.map((fact, index) => (
        <View
          key={fact}
          style={[
            stacked ? styles.factListed : styles.factBeside,
            index > 0 && (stacked ? styles.factDividedTop : styles.factDividedStart),
          ]}
        >
          <Text style={[styles.factText, !stacked && styles.factTextBeside]}>{fact}</Text>
        </View>
      ))}
    </View>
  )
}

// The stacked look is the base and the side-by-side one is laid over it,
// never the reverse: undoing a row's `flex: 1` with `flex: 0` collapses the
// block on the web, where `flex: 0` means a zero basis rather than "as tall
// as its contents".
const useStyles = makeStyles(({ v3 }) => ({
  hero: { gap: v3.space[16] },
  header: { gap: v3.space[12] },
  headerBeside: { alignItems: 'flex-start', flexDirection: 'row', gap: v3.space[14] },
  words: { gap: v3.space[4] },
  wordsBeside: { flex: 1, minWidth: 0 },
  title: { ...v3.type.title, color: v3.colors.fg },
  // ExtraBold at Black's size until Black has loaded, so the line does not
  // reflow when the face arrives — only thickens.
  titleFallback: { fontFamily: DISPLAY_FONT },
  body: { ...v3.type.callout, color: v3.colors.muted },
  note: { ...v3.type.caption, color: v3.colors.muted, fontWeight: '700' },
  // The pill keeps its own width under the words, as a store's Get button
  // does, rather than spanning the column.
  action: { alignItems: 'flex-start', paddingTop: v3.space[8] },
  actionButton: { width: 'auto' },
  facts: { borderBottomWidth: 1, borderColor: v3.colors.line, borderTopWidth: 1 },
  // The padding is what keeps the rules between cells short of the
  // hairlines above and below, as a store's strip draws them.
  factsBeside: { flexDirection: 'row', paddingVertical: v3.space[12] },
  // Flush with the name above it: a list under a stacked header starts where
  // the header's words do.
  factListed: { paddingVertical: v3.space[12] },
  factBeside: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: v3.space[8],
  },
  factDividedStart: { borderStartColor: v3.colors.line, borderStartWidth: 1 },
  factDividedTop: { borderTopColor: v3.colors.line, borderTopWidth: 1 },
  factText: { ...v3.type.buttonSmall, color: v3.colors.fg },
  factTextBeside: { textAlign: 'center' },
}))
