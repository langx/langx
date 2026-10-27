import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import type Feather from '@expo/vector-icons/Feather'
import { useFonts } from 'expo-font'
import { useEffect } from 'react'
import { Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { DISPLAY_FONT, makeStyles } from '../../lib/theme'
import { DELAY, SPRING, unlessReduced } from '../../lib/theme/motion'
import { Button } from '../ui/Button'
import { PRODUCT_MARKS, type Product } from './marks'
import { useToneColors, type ProductTone } from './tone'

type Glyph = keyof typeof Feather.glyphMap

/**
 * The product's name does not grow with the reader's text size. It is set at
 * Display, 44pt, already more than twice body text at the default size, and
 * there is no room above it: on a 375pt phone "Transparency" alone measures
 * 279pt of the hero's 295pt line, so any growth breaks the word in the
 * middle. The lines under it grow.
 */
const TITLE_MAX_SCALE = 1

/**
 * The headline under the name stops at 1.6×, about 35pt: still under the
 * name, so the name stays the biggest words on the block, and a long word
 * such as "practising" still fits the line on a 375pt phone.
 */
const HEADLINE_MAX_SCALE = 1.6

/**
 * The fact chips and the note stop at 2×, 26 and 28pt: they are the block's
 * small print, and past that they would stand larger than the product's name
 * above them.
 */
const FACT_MAX_SCALE = 2

/**
 * The action's label stops at 2×. At the largest size "introduction" alone is
 * wider than the pill on a 375pt phone and breaks in the middle; at 2× it fits
 * whole. A longer word — a German compound — still breaks, inside the pill
 * rather than past it (`Button`).
 */
const ACTION_MAX_SCALE = 2

/**
 * The mark's box. Not text, so it keeps its size whatever the reader's text
 * size: the biggest thing on the page, ahead of the name, because the mark is
 * what a person already knows the product by — the spark beside every amount,
 * Venus's face on the streak row. Big enough that it is the picture the page
 * opens on, not an icon beside a title.
 */
const MARK = 112

/** Where the mark starts its one bounce from, as a share of its size. */
const MARK_FROM = 0.6

interface ProductHeroProps {
  /** Whose page this is. The hero draws that product's own mark (`PRODUCT_MARKS`). */
  product: Product
  tone: ProductTone
  /** The product's name. The page's heading, so it is read first. */
  title: string
  /**
   * One short headline under the name: what the product is for, in the words
   * a person would use. Not a paragraph — the sections below carry the rest.
   */
  headline: string
  /**
   * Short facts as chips under the headline: "Beta"; "In-app points", "Can't
   * be bought", "Can't be traded". Each one a fact, never a slogan.
   */
  tags?: readonly string[]
  /** A quieter line at the foot: "Updated 4 minutes ago". */
  note?: string
  /**
   * The ink pill on the hero's colour. Not the yellow: a product page
   * describes, and the one committing action on it, if it has one, belongs
   * to the page.
   */
  action?: { label: string; onPress: () => void; icon?: Glyph }
}

/**
 * The top of every product page: the product's colour, its mark and its name.
 *
 * A stage rather than a header. The product's own mark stands large and bare
 * in the middle of the block — no disc or frame round it, which on the token
 * reads as a coin and on the others as a badge — then the name in Display and
 * one short headline, centred, so the block reads in one glance from the top
 * down, as the first screen of a good app tour does. Centred also means the
 * block is the same in a right-to-left language.
 *
 * Everything on it takes the tone's own text colour (`useToneColors`): the
 * page picks a colour and never a text colour, and the colour is the whole
 * decoration. The mark lands once, with one bounce, after the screen has
 * arrived; with reduce motion it is simply there.
 */
export function ProductHero({
  product,
  tone,
  title,
  headline,
  tags,
  note,
  action,
}: ProductHeroProps) {
  const styles = useStyles()
  const { ground, on } = useToneColors(tone)
  const reduce = useReduceMotion()
  // Loaded here rather than at the root, as every screen that draws it does:
  // a cold start should not wait for a face most launches never show.
  const [black] = useFonts({ Nunito_900Black })

  const scale = useSharedValue(reduce ? 1 : MARK_FROM)
  // Started from an effect, never from render: see `lib/theme/motion`. After
  // the push, so the bounce is not spent under the transition that brought
  // the screen in.
  useEffect(() => {
    scale.set(
      unlessReduced(reduce, 1, (to) => withDelay(DELAY.afterPush, withSpring(to, SPRING.bounce))),
    )
  }, [reduce, scale])
  const landing = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }))

  return (
    <View style={[styles.hero, { backgroundColor: ground }]}>
      <Animated.View
        style={[styles.mark, landing]}
        // The name under it says what it is; the mark alone is decoration.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {PRODUCT_MARKS[product]({ size: MARK, color: on })}
      </Animated.View>
      <View style={styles.words}>
        <Text
          style={[styles.title, !black && styles.titleFallback, { color: on }]}
          accessibilityRole="header"
          maxFontSizeMultiplier={TITLE_MAX_SCALE}
        >
          {title}
        </Text>
        <Text style={[styles.headline, { color: on }]} maxFontSizeMultiplier={HEADLINE_MAX_SCALE}>
          {headline}
        </Text>
      </View>
      {tags && tags.length > 0 ? (
        <View style={styles.tags}>
          {tags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={[styles.tagText, { color: on }]} maxFontSizeMultiplier={FACT_MAX_SCALE}>
                {tag}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {action ? (
        <Button
          label={action.label}
          variant="hue"
          size="medium"
          {...(action.icon ? { icon: action.icon } : {})}
          maxFontSizeMultiplier={ACTION_MAX_SCALE}
          onPress={action.onPress}
        />
      ) : null}
      {note ? (
        <Text style={[styles.note, { color: on }]} maxFontSizeMultiplier={FACT_MAX_SCALE}>
          {note}
        </Text>
      ) : null}
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  hero: {
    alignItems: 'center',
    borderRadius: v3.radius.hero,
    gap: v3.space[16],
    paddingBottom: v3.space[24],
    paddingHorizontal: v3.space[20],
    paddingTop: v3.space[32],
  },
  mark: { alignItems: 'center', height: MARK, justifyContent: 'center', width: MARK },
  words: { alignSelf: 'stretch', gap: v3.space[8] },
  title: { ...v3.type.display, textAlign: 'center' },
  // ExtraBold at Black's size until Black has loaded, so the line does not
  // reflow when the face arrives — only thickens.
  titleFallback: { fontFamily: DISPLAY_FONT },
  // The headline step, not body: one line meant to be read from arm's length,
  // the way an app tour's screens say what they are for.
  headline: { ...v3.type.headline, textAlign: 'center' },
  tags: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: v3.space[6],
    justifyContent: 'center',
  },
  // Ink washed over the tone rather than an outline: a chip on a coloured
  // block, as the call stage draws its own.
  // `maxWidth`: at the largest text sizes one fact is wider than the block,
  // and it should wrap inside its chip rather than run off the hero's edge.
  // `radius.icon` rather than `pill` for the same case: 12 is half a one-line
  // tag at the default size (a 16pt line, 4 above and below), so there it is
  // the same pill, but a fact wrapped onto two lines keeps rounded corners
  // instead of becoming a stadium whose curves crowd its first and last letters.
  tag: {
    backgroundColor: v3.colors.hueWash,
    borderRadius: v3.radius.icon,
    maxWidth: '100%',
    paddingHorizontal: v3.space[10],
    paddingVertical: v3.space[4],
  },
  tagText: { ...v3.type.label, textAlign: 'center' },
  note: { ...v3.type.caption, fontWeight: '600', textAlign: 'center' },
}))
