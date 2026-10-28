import Feather from '@expo/vector-icons/Feather'
import { useEffect } from 'react'
import { Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { PRODUCT_TEXT_SCALE } from '../../lib/productPage'
import { makeStyles, useTheme } from '../../lib/theme'
import { SPRING, TIMING, unlessReduced } from '../../lib/theme/motion'
import { useGlyphScale, useStacked } from '../product/ProductGroup'
import { useWordFit, WidestWord } from '../product/WidestWord'
import { PressableScale } from '../ui/PressableScale'

interface PlanCardProps {
  selected: boolean
  onSelect: () => void
  /** "Yearly", "Monthly". */
  title: string
  /** What the store will charge, with its period — "$79.99 a year". The card's largest words. */
  price: string
  /** The computed figures under it — "$6.66 a month · 3 months free" — when there is an honest one. */
  badge?: string | null
  /** A quiet line for what the price does not say — a one-off payment that never renews. */
  detail?: string | null
  /** The whole card as one sentence, since a screen reader reads it as one control. */
  accessibilityLabel: string
}

/**
 * One way to pay for Pro, as a block you pick rather than a tab you switch.
 *
 * **The charge is the biggest thing on it.** The period's name sits above in
 * small muted type, the store's price and its period under that at headline
 * size, and anything computed from them — what a year comes to a month, the
 * months it gives away — in a coloured badge below, at the small size of the
 * name above it. Colour is how the badge is found, not size: both stores want
 * the billed amount to be the most prominent price on the screen, and the
 * month a year works out to is the figure they name when it is not
 * (`planPrice.ts`).
 *
 * Picked is an ink outline on the ground, the rest are grey blocks; the
 * border is the same width either way, so picking a card never moves a pixel
 * of the layout around it. The check is the one thing that springs: it is the
 * part the finger just caused. With reduced motion it is simply there.
 *
 * At the larger text sizes the radio stands over the words, so the price gets
 * the card's whole width, as a product page's row puts its square
 * (`ProductRow`); it grows with them (`useGlyphScale`). Every line stops
 * growing where a product page's does, the price at a heading's 2×, so it
 * stays the largest figure on the card and on the screen — or sooner, where
 * a word of it would not fit the card whole (`useWordFit`): the price is the
 * store's own string, and Russian's "единоразово" ran out of a 320pt
 * screen's card at 2×.
 */
export function PlanCard({
  selected,
  onSelect,
  title,
  price,
  badge,
  detail,
  accessibilityLabel,
}: PlanCardProps) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const reduceMotion = useReduceMotion()
  const stacked = useStacked()
  const glyph = useGlyphScale()
  const priceFit = useWordFit(PRODUCT_TEXT_SCALE.heading)
  const on = useSharedValue(selected ? 1 : 0)

  useEffect(() => {
    // A little overshoot on the way in, because the tap carried the intent;
    // none on the way out.
    on.set(
      unlessReduced(reduceMotion, selected ? 1 : 0, (to) =>
        to === 1 ? withSpring(to, SPRING.select) : withTiming(to, TIMING.release),
      ),
    )
  }, [on, reduceMotion, selected])

  const checkStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, on.get() * 2),
    transform: [{ scale: 0.6 + 0.4 * on.get() }],
  }))

  const radio = (
    <View
      style={[
        styles.radio,
        { height: RADIO * glyph, width: RADIO * glyph },
        stacked && styles.radioAbove,
      ]}
    >
      <Animated.View style={[styles.check, checkStyle]}>
        <Feather name="check" size={Math.round(v3.icon.xs * glyph)} color={v3.colors.onBlue} />
      </Animated.View>
    </View>
  )

  return (
    <PressableScale
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={accessibilityLabel}
      onPress={onSelect}
      style={[styles.card, selected ? styles.cardSelected : null]}
    >
      {stacked ? null : radio}
      <View
        style={styles.text}
        onLayout={(event) => priceFit.setLine(event.nativeEvent.layout.width)}
      >
        {stacked ? radio : null}
        <Text style={styles.title} maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.text}>
          {title}
        </Text>
        <Text style={styles.price} maxFontSizeMultiplier={priceFit.scale}>
          {price}
        </Text>
        {detail ? (
          <Text style={styles.detail} maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.text}>
            {detail}
          </Text>
        ) : null}
        {/* Wraps rather than truncates, so a long translation never hides a figure. */}
        {badge ? (
          <View style={[styles.badge, stacked && styles.badgeStacked]}>
            <Text style={styles.badgeText} maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.text}>
              {badge}
            </Text>
          </View>
        ) : null}
        <WidestWord text={price} style={styles.price} onWidth={priceFit.setWidest} />
      </View>
    </PressableScale>
  )
}

/** The radio's diameter: a step over the glyph, under the 44pt row it sits in. */
const RADIO = 26

const useStyles = makeStyles(({ v3 }) => ({
  card: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    borderWidth: 3,
    flexDirection: 'row',
    gap: v3.space[12],
    // The size the paywall's brief sets for a plan: a block a thumb lands on
    // without aiming, whatever the card has to say.
    minHeight: 96,
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[10],
  },
  cardSelected: { backgroundColor: v3.colors.bg, borderColor: v3.colors.fg },
  radio: {
    alignItems: 'center',
    borderColor: v3.colors.muted,
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    height: RADIO,
    justifyContent: 'center',
    width: RADIO,
  },
  radioAbove: { marginBottom: v3.space[6] },
  // Over the ring, filling it: picked reads as a blue disc with a tick, not
  // as a dot inside an outline.
  check: {
    alignItems: 'center',
    backgroundColor: v3.colors.blue,
    borderRadius: v3.radius.pill,
    bottom: -2,
    end: -2,
    justifyContent: 'center',
    position: 'absolute',
    start: -2,
    top: -2,
  },
  text: { alignItems: 'flex-start', flex: 1, gap: v3.space[2] },
  title: { ...v3.type.label, color: v3.colors.muted },
  price: { ...v3.type.headline, color: v3.colors.fg },
  detail: { ...v3.type.caption, color: v3.colors.muted },
  badge: {
    backgroundColor: v3.hues.mint,
    borderRadius: v3.radius.pill,
    marginTop: v3.space[4],
    paddingHorizontal: v3.space[10],
    paddingVertical: v3.space[2],
  },
  // A row's corner rather than a pill's at the larger sizes: still a pill on
  // one line, since a corner never exceeds half the height, and a rounded
  // block once the figures wrap, where a pill's ends ran into the first and
  // last letters.
  badgeStacked: { borderRadius: v3.radius.row },
  badgeText: { ...v3.type.label, color: v3.colors.ink },
}))
