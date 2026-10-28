import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import Feather from '@expo/vector-icons/Feather'
import { useFonts } from 'expo-font'
import { useState } from 'react'
import { Text, View, type LayoutChangeEvent, type StyleProp, type TextStyle } from 'react-native'
import { PRODUCT_TEXT_SCALE } from '../../lib/productPage'
import { DISPLAY_FONT, makeStyles, useTheme } from '../../lib/theme'
import { PressableScale } from '../ui/PressableScale'
import { BALANCED, useGlyphScale, useStacked, useTextDirection } from './ProductGroup'
import { ProductMark, type ProductMarkName } from './ProductMark'
import type { ProductTone } from './tone'
import { WordFitText } from './WordFitText'

type Glyph = keyof typeof Feather.glyphMap

/**
 * The mark's tile. Large enough to read as the product's own mark rather
 * than a small badge beside a name, and small enough to leave the name a
 * 239pt column beside it on a 375pt phone. Not text, so it keeps its size
 * whatever the reader's text size.
 */
const MARK = 88

/** Between the mark and the words beside it. */
const MARK_GAP = 16

/** The inset of a fact in its cell, either side. */
const FACT_INSET = 6

/** The rule between two cells of the facts strip. */
const HAIRLINE = 1

/** The dot between two facts on one line. */
const DOT = 4

interface ProductHeroProps {
  tone: ProductTone
  /** The product's own mark (`ProductMark`): LangX Token's spark, Copilot's chip, Venus's face. */
  mark: ProductMarkName
  /** The product's name. The page's heading, so it is read first. */
  title: string
  /** One line on what it is. */
  body: string
  /**
   * Two or three short facts under the header: "In-app points", "Can't be
   * bought", "Can't be traded". Each one a fact, never a slogan.
   */
  facts?: readonly string[]
  /** A quieter line under the body: "Part of Pro", "Updated 4 minutes ago". */
  note?: string
  /**
   * The page's one action, under the words as a store listing has its Get
   * button: a small tinted pill that opens something and commits to nothing,
   * so it never outweighs the mark and the name beside it.
   */
  action?: { label: string; onPress: () => void; icon?: Glyph }
}

/**
 * The top of every product page: the product's mark beside its name, the
 * way an app stands in a store listing, and its facts in one quiet band.
 *
 * Compact on purpose. The page is a reference a person scrolls with a thumb,
 * so its top says what the product is in the first screen and leaves the
 * rest of that screen to the rows under it. The product's colour is on its
 * mark and on its rows' squares, never a block of its own.
 *
 * Two things are decided by measuring rather than guessed from the text
 * size, because they depend on the words as much as on their size: whether
 * the name's longest word fits beside the mark (if not, the mark goes above
 * it), and whether every fact fits its cell of the strip on one line (if
 * not, the facts are one line of their own, dotted between).
 */
export function ProductHero({ tone, mark, title, body, facts, note, action }: ProductHeroProps) {
  const styles = useStyles()
  // Loaded here rather than at the root, as every screen that draws it does:
  // a cold start should not wait for a face most launches never show.
  const [black] = useFonts({ Nunito_900Black })
  const largeText = useStacked()
  const direction = useTextDirection()
  const [width, setWidth] = useState(0)
  const [measured, setMeasured] = useState<Readonly<Record<string, number>>>({})

  const titleStyle = [styles.title, direction, !black && styles.titleFallback]
  const words = title.split(/\s+/).filter(Boolean)
  const wordKeys = words.map((_, index) => `word${index}`)
  const factList = facts ?? []
  const factKeys = factList.map((_, index) => `fact${index}`)

  // Until a width is known the guess is the roomy layout: a name that fits,
  // facts in their strip. Measuring only ever takes room away.
  const widthsOf = (keys: readonly string[]) =>
    width > 0 && keys.every((key) => measured[key] !== undefined)
      ? keys.map((key) => measured[key] ?? 0)
      : null
  const wordWidths = widthsOf(wordKeys)
  const nameBeside = wordWidths === null || Math.max(...wordWidths) <= width - MARK - MARK_GAP
  const stacked = largeText || !nameBeside
  const factWidths = widthsOf(factKeys)
  const cell = factList.length > 0 ? width / factList.length - 2 * FACT_INSET - HAIRLINE : 0
  const strip = factWidths === null || factWidths.every((w) => w <= cell)

  const onMeasure = (key: string, value: number) =>
    setMeasured((current) => (current[key] === value ? current : { ...current, [key]: value }))

  return (
    <View
      style={styles.hero}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
    >
      <Measure
        items={[
          ...words.map((word, index) => ({
            key: `word${index}`,
            text: word,
            style: titleStyle,
            maxScale: PRODUCT_TEXT_SCALE.name,
          })),
          ...factList.map((fact, index) => ({
            key: `fact${index}`,
            text: fact,
            style: styles.factText,
            maxScale: PRODUCT_TEXT_SCALE.text,
          })),
        ]}
        onWidth={onMeasure}
      />
      <View style={[styles.header, !stacked && styles.headerBeside]}>
        <ProductMark tone={tone} mark={mark} size={MARK} />
        <View style={[styles.words, !stacked && styles.wordsBeside]}>
          {/*
            Stacked, the name has the whole width and may still not hold its
            longest word at the name's cap: "Прозрачность" at 48pt is wider
            than a 375pt phone's column.
          */}
          <WordFitText style={titleStyle} accessibilityRole="header" cap={PRODUCT_TEXT_SCALE.name}>
            {title}
          </WordFitText>
          <WordFitText
            style={[styles.body, direction, BALANCED]}
            cap={PRODUCT_TEXT_SCALE.text}
            // Never a lone last word under a full line (`BALANCED`).
            textBreakStrategy="balanced"
            lineBreakStrategyIOS="push-out"
          >
            {body}
          </WordFitText>
          {note ? (
            <WordFitText style={[styles.note, direction]} cap={PRODUCT_TEXT_SCALE.text}>
              {note}
            </WordFitText>
          ) : null}
          {action ? <HeroAction action={action} /> : null}
        </View>
      </View>
      {factList.length > 0 ? (
        <View
          style={styles.facts}
          accessible
          // One statement in parts, so one item: "In-app points, Can't be
          // bought, Can't be traded".
          accessibilityLabel={factList.join(', ')}
        >
          {strip ? <FactStrip facts={factList} /> : <FactLine facts={factList} />}
        </View>
      ) : null}
    </View>
  )
}

/**
 * Each text drawn once, unseen and out of the layout, at its real size and
 * face, to learn how wide it is on one line. Hidden from every screen reader
 * and from touch.
 */
function Measure({
  items,
  onWidth,
}: {
  items: readonly { key: string; text: string; style: StyleProp<TextStyle>; maxScale: number }[]
  onWidth: (key: string, width: number) => void
}) {
  const styles = useStyles()
  return (
    <View
      style={styles.measure}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {items.map((item) => (
        <View
          key={item.key}
          style={styles.measured}
          onLayout={(event: LayoutChangeEvent) => onWidth(item.key, event.nativeEvent.layout.width)}
        >
          <Text style={item.style} maxFontSizeMultiplier={item.maxScale}>
            {item.text}
          </Text>
        </View>
      ))}
    </View>
  )
}

/**
 * The facts as a store listing's strip: equal cells between the band's two
 * hairlines, a short rule between cells. Only drawn when every fact fits its
 * cell on one line — two-line cells read as cramped, heavy figures, and these
 * are a quiet statement.
 */
function FactStrip({ facts }: { facts: readonly string[] }) {
  const styles = useStyles()
  const direction = useTextDirection()
  return (
    <View style={styles.strip}>
      {facts.map((fact, index) => (
        <View key={`fact${index}`} style={[styles.cell, index > 0 && styles.cellDivided]}>
          <Text
            style={[styles.factText, styles.factCentred, direction]}
            maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.text}
          >
            {fact}
          </Text>
        </View>
      ))}
    </View>
  )
}

/**
 * The facts when they do not fit the strip: one centred line, wrapping as it
 * needs to, with a dot between two facts that share a line and none where the
 * line breaks. A dot at the end of each fact would hang at the edge of every
 * wrapped line ("Can't be bought ·"), so each fact reports the line it landed
 * on, and the dot before it is drawn only when the fact before it is on the
 * same one.
 *
 * The dot is drawn, not typed: the band is read as one item and never says
 * it. It sits in the gap between two facts rather than taking room of its
 * own, so showing it cannot push a fact onto the next line.
 */
function FactLine({ facts }: { facts: readonly string[] }) {
  const styles = useStyles()
  const direction = useTextDirection()
  const [lines, setLines] = useState<readonly number[]>([])
  return (
    <View style={styles.line}>
      {facts.map((fact, index) => (
        <View
          key={`fact${index}`}
          style={styles.lineFact}
          onLayout={(event: LayoutChangeEvent) => {
            const y = Math.round(event.nativeEvent.layout.y)
            setLines((current) => {
              if (current[index] === y) return current
              const next = [...current]
              next[index] = y
              return next
            })
          }}
        >
          {index > 0 && lines[index] !== undefined && lines[index] === lines[index - 1] ? (
            <View style={styles.dotSlot}>
              <View style={styles.dot} />
            </View>
          ) : null}
          <Text
            style={[styles.factText, styles.factCentred, direction]}
            maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.text}
          >
            {fact}
          </Text>
        </View>
      ))}
    </View>
  )
}

/**
 * The page's one action, as a store draws Get: a small pill tinted grey with
 * a blue label, hugging its words under the name. Not the solid blue — beside
 * Copilot's blue tile a blue pill read as a second tile, and at the button's
 * full size it outweighed the mark and the name it serves. The face is 32pt;
 * the touch area round it is the 44 every target has.
 */
function HeroAction({ action }: { action: NonNullable<ProductHeroProps['action']> }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const glyph = useGlyphScale()
  const direction = useTextDirection()
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={action.label}
      onPress={action.onPress}
      touchStyle={styles.actionTouch}
      style={styles.action}
    >
      {action.icon ? (
        <Feather
          name={action.icon}
          size={Math.round(v3.icon.xs * glyph)}
          color={v3.colors.echoText}
        />
      ) : null}
      <Text style={[styles.actionLabel, direction]} maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.text}>
        {action.label}
      </Text>
    </PressableScale>
  )
}

// The stacked look is the base and the side-by-side one is laid over it,
// never the reverse: undoing a row's `flex: 1` with `flex: 0` collapses the
// block on the web, where `flex: 0` means a zero basis rather than "as tall
// as its contents".
const useStyles = makeStyles(({ v3 }) => ({
  hero: { gap: v3.space[16] },
  header: { gap: v3.space[12] },
  headerBeside: { alignItems: 'flex-start', flexDirection: 'row', gap: MARK_GAP },
  words: { gap: v3.space[4] },
  wordsBeside: { flex: 1, minWidth: 0 },
  title: { ...v3.type.title, color: v3.colors.fg },
  // ExtraBold at Black's size until Black has loaded, so the line does not
  // reflow when the face arrives — only thickens.
  titleFallback: { fontFamily: DISPLAY_FONT },
  body: { ...v3.type.callout, color: v3.colors.muted },
  note: { ...v3.type.caption, color: v3.colors.muted, fontWeight: '700' },
  // Out of the layout and unseen; each item hugs its own words.
  measure: {
    alignItems: 'flex-start',
    opacity: 0,
    pointerEvents: 'none',
    position: 'absolute',
    start: 0,
    top: 0,
  },
  measured: { alignSelf: 'flex-start' },
  // The touch area: the pill's own width, 6pt above and below its 32pt face.
  actionTouch: { alignSelf: 'flex-start', marginTop: v3.space[4], paddingVertical: v3.space[6] },
  // `maxWidth` and the label's `minWidth: 0` keep a label grown past the
  // column inside the pill on the web, as `Button` does.
  action: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[6],
    maxWidth: '100%',
    minHeight: v3.space[32],
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[6],
  },
  // `echoText` is the palette's blue for words; the fill `blue` fails as text.
  actionLabel: { ...v3.type.label, color: v3.colors.echoText, flexShrink: 1, minWidth: 0 },
  facts: {
    borderBottomWidth: 1,
    borderColor: v3.colors.line,
    borderTopWidth: 1,
    paddingVertical: v3.space[12],
  },
  strip: { flexDirection: 'row' },
  cell: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: FACT_INSET,
  },
  cellDivided: { borderStartColor: v3.colors.line, borderStartWidth: HAIRLINE },
  line: {
    columnGap: v3.space[20],
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    rowGap: v3.space[2],
  },
  // `maxWidth`: at the largest text sizes one fact is wider than the band,
  // and it should wrap in place rather than run off the edge.
  lineFact: { maxWidth: '100%' },
  factText: { ...v3.type.label, color: v3.colors.muted },
  factCentred: { textAlign: 'center' },
  // In the middle of the gap before its fact, and of the fact's height. A
  // fact never wraps inside itself while it shares a line — wrapping means it
  // took the whole width — so its middle is its one line's, at any text size.
  dotSlot: {
    bottom: 0,
    justifyContent: 'center',
    position: 'absolute',
    start: -(v3.space[20] + DOT) / 2,
    top: 0,
  },
  dot: { backgroundColor: v3.colors.muted, borderRadius: v3.radius.pill, height: DOT, width: DOT },
}))
