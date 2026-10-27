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
import {
  PRESS_SCALE_CARD,
  PRESS_SCALE_GLYPH,
  SPRING,
  STAGGER,
  unlessReduced,
} from '../../lib/theme/motion'
import { BALANCED, ROW_SQUARE, useGlyphScale, useStacked } from '../product/ProductGroup'
import { ProductMark, type ProductMarkName } from '../product/ProductMark'
import type { ProductTone } from '../product/tone'
import { PressableScale } from '../ui/PressableScale'
import { CARD_INSET, HomeCardRows } from './HomeCards'

/** How far a card rises as it arrives: enough to read as arriving, not as travelling. */
const RISE = 8

/** Today's video's ▶: as tall as the mark beside it, 40 drawn and 48 to the touch. */
const PLAY = ROW_SQUARE

/** The unwatched dot on Venus's mark, edge and all. */
const DOT = 14

export interface HomeProductCard {
  key: string
  tone: ProductTone
  mark: ProductMarkName
  name: string
  /** One live line: a count, a balance, a state. */
  line: string
  onPress: () => void
  /** Venus's: today's video not yet watched to its end, a dot on her mark. */
  dot?: boolean | undefined
  /** Venus's: today's video, when there is one — a ▶ on the card's corner that plays it. */
  play?: { label: string; onPress: () => void } | undefined
}

/**
 * Home's "LangX" section (plan #2067, §8): a card for each product page,
 * two by two while their words fit and one to a row when they do not
 * (`HomeCardRows`). Each card is the product's mark in its own colour, its
 * name and one live line, and opens its page — the colour and mark the page
 * itself opens with, so the card and the page read as one thing.
 *
 * Venus's card is also where today's video is (plan #2067, decision 1 of
 * 27 Oct): a ▶ on its corner plays it, and until it has been watched to its
 * end her mark wears the unwatched dot. The ▶ is a sibling laid over the
 * card rather than a button inside it — a screen reader cannot reach a
 * button nested in another one on iOS — so it is found as a target of its
 * own after the card, named for what it does.
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
  // The mark, the dot and the ▶ grow with the words, as every row's square does.
  const square = ROW_SQUARE * glyph
  const play = PLAY * glyph
  const dot = DOT * glyph
  return (
    <>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${card.name}. ${card.line}`}
        onPress={card.onPress}
        scaleTo={PRESS_SCALE_CARD}
        touchStyle={styles.grow}
        style={[styles.card, tile ? styles.tile : styles.row]}
      >
        <View style={tile ? styles.markTile : null}>
          <ProductMark tone={card.tone} mark={card.mark} size={square} />
          {/*
            Where a badge sits on an avatar, edged in the card's own ground so
            it reads as laid over the mark, in the streak's tangerine — the
            colour the streak page's strip rings today's unwatched video in.
          */}
          {card.dot ? (
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: v3.hues.tangerine,
                  bottom: -dot / 4,
                  end: -dot / 4,
                  height: dot,
                  width: dot,
                },
              ]}
            />
          ) : null}
        </View>
        <View
          style={[
            styles.words,
            !tile && styles.wordsRow,
            // As a row, room at its end for the ▶ laid over it, and the row's gap before it.
            !tile && card.play ? { paddingEnd: play + v3.space[12] } : null,
          ]}
        >
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
        {tile || card.play ? null : (
          <Feather
            name={isRtl ? 'chevron-left' : 'chevron-right'}
            size={Math.round(v3.icon.md * glyph)}
            color={v3.colors.muted}
          />
        )}
      </PressableScale>
      {card.play ? (
        <View style={[styles.playSpot, tile ? styles.playCorner : styles.playEnd]}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={card.play.label}
            onPress={card.play.onPress}
            scaleTo={PRESS_SCALE_GLYPH}
            hitSlop={4}
          >
            <View style={[styles.play, { height: play, width: play }]}>
              {/* Nudged a point forward: a triangle's weight sits behind its middle. */}
              <Feather
                name="play"
                size={Math.round(v3.icon.md * glyph)}
                color={v3.colors.pillText}
                style={styles.playGlyph}
              />
            </View>
          </PressableScale>
        </View>
      ) : null}
    </>
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
  // The mark's box, for the dot laid over its corner: as a tile, only as wide as the mark.
  markTile: { alignSelf: 'flex-start' },
  dot: {
    borderColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    position: 'absolute',
  },
  // Over the card, never inside it: it takes touches only on the ▶ itself.
  playSpot: { pointerEvents: 'box-none', position: 'absolute' },
  // As a tile, in the top corner level with the mark, which is the ▶'s height.
  playCorner: { end: v3.space[CARD_INSET], top: v3.space[CARD_INSET] },
  // As a row, at its end where the chevron would be, centred top to bottom.
  playEnd: { bottom: 0, end: v3.space[CARD_INSET], justifyContent: 'center', top: 0 },
  play: {
    alignItems: 'center',
    backgroundColor: v3.colors.pill,
    borderRadius: v3.radius.pill,
    justifyContent: 'center',
  },
  playGlyph: { transform: [{ translateX: 1 }] },
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
