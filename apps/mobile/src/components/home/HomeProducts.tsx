import Feather from '@expo/vector-icons/Feather'
import { useEffect, type ReactNode } from 'react'
import { Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useLocale } from '../../i18n'
import { PRODUCT_TEXT_SCALE } from '../../lib/productPage'
import { makeStyles, useTheme } from '../../lib/theme'
import { PRESS_SCALE_CARD, SPRING, STAGGER, unlessReduced } from '../../lib/theme/motion'
import { BALANCED, ROW_SQUARE, useGlyphScale, useStacked } from '../product/ProductGroup'
import { ProductMark, type ProductMarkName } from '../product/ProductMark'
import type { ProductTone } from '../product/tone'
import { PressableScale } from '../ui/PressableScale'
import { CARD_INSET, HomeCardRows } from './HomeCards'

/** How far a card rises as it arrives: enough to read as arriving, not as travelling. */
const RISE = 8

export interface HomeProductCard {
  key: string
  tone: ProductTone
  mark: ProductMarkName
  name: string
  /** One live line: a count, a balance, a state. */
  line: string
  onPress: () => void
}

/**
 * Home's "LangX" section (plan #2067, §8): a card for each product page,
 * two by two while their words fit and one to a row when they do not
 * (`HomeCardRows`). Each card is the product's mark in its own colour, its
 * name and one live line, and opens its page — the colour and mark the page
 * itself opens with, so the card and the page read as one thing.
 *
 * The cards arrive one after another, once, the first time Home draws them;
 * with reduce motion on they are simply there. Dumb like Home's other
 * blocks: the screen chooses the words.
 */
export function HomeProducts({
  title,
  cards,
}: {
  title: string
  cards: readonly HomeProductCard[]
}) {
  const styles = useStyles()
  const { isRtl } = useLocale()
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text
          style={[styles.sectionTitle, isRtl ? styles.rtl : styles.ltr]}
          accessibilityRole="header"
          maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.heading}
        >
          {title}
        </Text>
      </View>
      <HomeCardRows
        texts={cards.flatMap((card) => [
          { text: card.name, style: styles.name, maxScale: PRODUCT_TEXT_SCALE.rowTitle },
          { text: card.line, style: styles.line, maxScale: PRODUCT_TEXT_SCALE.text },
        ])}
        render={({ beside, cell }) =>
          cards.map((card, index) => (
            <Arrive key={card.key} index={index} style={cell}>
              <ProductCard card={card} beside={beside} />
            </Arrive>
          ))
        }
      />
    </View>
  )
}

function ProductCard({ card, beside }: { card: HomeProductCard; beside: boolean }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const { isRtl } = useLocale()
  const glyph = useGlyphScale()
  const stacked = useStacked()
  // At the larger text sizes a card one to a row is still a tile, its mark
  // over its words and no chevron, so the name has the card's whole width:
  // beside the mark and a chevron, "Transparência" and "Прозрачность" broke
  // in the middle at the largest size.
  const tile = beside || stacked
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${card.name}. ${card.line}`}
      onPress={card.onPress}
      scaleTo={PRESS_SCALE_CARD}
      touchStyle={styles.grow}
      style={[styles.card, tile ? styles.tile : styles.row]}
    >
      {/* A row's square, growing with the words as every row's square does. */}
      <ProductMark tone={card.tone} mark={card.mark} size={ROW_SQUARE * glyph} />
      <View style={[styles.words, !tile && styles.wordsRow]}>
        <Text
          style={[styles.name, isRtl ? styles.rtl : styles.ltr]}
          maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.rowTitle}
        >
          {card.name}
        </Text>
        {/* Balanced, as a product row's line is: "Start with 250 / tokens" left a word alone. */}
        <Text
          style={[styles.line, isRtl ? styles.rtl : styles.ltr, BALANCED]}
          maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.text}
          textBreakStrategy="balanced"
          lineBreakStrategyIOS="push-out"
        >
          {card.line}
        </Text>
      </View>
      {tile ? null : (
        <Feather
          name={isRtl ? 'chevron-left' : 'chevron-right'}
          size={Math.round(v3.icon.md * glyph)}
          color={v3.colors.muted}
        />
      )}
    </PressableScale>
  )
}

/**
 * A card rising into place, `STAGGER` after the one before it, on the
 * spring a thing settling home uses — no bounce on a card a thumb is about
 * to reach for. Started from an effect once the view exists: a spring
 * started before its view did froze part-way on the web build once (see the
 * hourly gift).
 */
function Arrive({
  index,
  style,
  children,
}: {
  index: number
  style: StyleProp<ViewStyle>
  children: ReactNode
}) {
  const reduceMotion = useReduceMotion()
  const progress = useSharedValue(reduceMotion ? 1 : 0)

  useEffect(() => {
    progress.set(
      unlessReduced(reduceMotion, 1, (to) =>
        withDelay(index * STAGGER, withSpring(to, SPRING.settle)),
      ),
    )
  }, [index, progress, reduceMotion])

  const animated = useAnimatedStyle(() => ({
    opacity: Math.min(progress.get(), 1),
    transform: [{ translateY: (1 - progress.get()) * RISE }],
  }))

  return <Animated.View style={[style, animated]}>{children}</Animated.View>
}

const useStyles = makeStyles(({ v3 }) => ({
  section: { gap: v3.space[8] },
  sectionHead: { paddingHorizontal: v3.space[6] },
  sectionTitle: { ...v3.type.headline, color: v3.colors.fg },
  grow: { flexGrow: 1 },
  card: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    padding: v3.space[CARD_INSET],
  },
  tile: { flexGrow: 1, gap: v3.space[10] },
  row: { alignItems: 'center', flexDirection: 'row', flexGrow: 1, gap: v3.space[12] },
  words: { gap: v3.space[2], minWidth: 0 },
  wordsRow: { flex: 1 },
  name: { ...v3.type.button, color: v3.colors.fg },
  line: { ...v3.type.caption, color: v3.colors.muted },
  // The paragraph's direction is the layout's: "LangX" and "Copilot" have no
  // Arabic letters, so the web build's `dir="auto"` read them left to right
  // and pinned them to the left in Arabic.
  rtl: { writingDirection: 'rtl' },
  ltr: { writingDirection: 'ltr' },
}))
