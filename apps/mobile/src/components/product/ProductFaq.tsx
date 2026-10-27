import Feather from '@expo/vector-icons/Feather'
import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useLocale, useT } from '../../i18n'
import { PRODUCT_TEXT_SCALE } from '../../lib/productPage'
import { makeStyles, useTheme } from '../../lib/theme'
import { TIMING, unlessReduced } from '../../lib/theme/motion'
import { Reveal } from '../paywall/Reveal'
import { BALANCED, ProductGroup, useGlyphScale } from './ProductGroup'
import { ProductSection } from './ProductSection'

export interface ProductQuestion {
  key: string
  question: string
  /** Checked against the code before it is written; numbers from `packages/shared`, never typed. */
  answer: string
}

/**
 * The questions at the foot of every product page (plan item 7): six to eight,
 * then the product's own site for the rest.
 *
 * One block of disclosure rows, as a settings list draws them: the question,
 * and a chevron pointing onward that turns down when its answer opens under
 * it. One open at a time — opening a second closes the first, so the block
 * never grows into a wall of answers the reader has to scroll back past.
 * Each question is a button whose expanded state the platform announces, so
 * no words of ours are needed for it. With reduce motion on, neither the
 * chevron nor the answer moves; the answer is simply there.
 */
export function ProductFaq({
  items,
  title,
}: {
  items: readonly ProductQuestion[]
  /** The section's heading. "Questions and answers" unless a page needs its own. */
  title?: string
}) {
  const t = useT()
  const [open, setOpen] = useState<string | null>(null)

  return (
    <ProductSection title={title ?? t('productPage.questions')}>
      <ProductGroup>
        {items.map((item) => (
          <QuestionRow
            key={item.key}
            item={item}
            open={open === item.key}
            onToggle={() => setOpen((current) => (current === item.key ? null : item.key))}
          />
        ))}
      </ProductGroup>
    </ProductSection>
  )
}

function QuestionRow({
  item,
  open,
  onToggle,
}: {
  item: ProductQuestion
  open: boolean
  onToggle: () => void
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const { isRtl } = useLocale()
  const reduce = useReduceMotion()
  const glyph = useGlyphScale()
  const turn = useSharedValue(open ? 1 : 0)

  // Started from an effect, never from render: see `lib/theme/motion`.
  useEffect(() => {
    turn.set(unlessReduced(reduce, open ? 1 : 0, (to) => withTiming(to, TIMING.fill)))
  }, [open, reduce, turn])

  // Onward is the reading direction's end, so the quarter turn down goes the
  // other way in a right-to-left language.
  const quarter = isRtl ? -90 : 90
  const chevron = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.get() * quarter}deg` }],
  }))

  return (
    <View style={styles.item}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        // The same state again for the web build, where react-native-web
        // reads only `aria-*` and drops `accessibilityState` without a word.
        aria-expanded={open}
        accessibilityLabel={item.question}
        onPress={onToggle}
        style={({ pressed }) => [styles.question, pressed && styles.pressed]}
      >
        <Text
          style={[styles.questionText, BALANCED]}
          maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.text}
          textBreakStrategy="balanced"
          lineBreakStrategyIOS="push-out"
        >
          {item.question}
        </Text>
        <Animated.View style={chevron}>
          <Feather
            name={isRtl ? 'chevron-left' : 'chevron-right'}
            size={Math.round(v3.icon.md * glyph)}
            color={v3.colors.muted}
          />
        </Animated.View>
      </Pressable>
      {open ? (
        <Reveal index={0} style={styles.answer}>
          <Text
            style={[styles.answerText, BALANCED]}
            maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.text}
            textBreakStrategy="balanced"
            lineBreakStrategyIOS="push-out"
          >
            {item.answer}
          </Text>
        </Reveal>
      ) : null}
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  // The hairline above each question, as every row in a `ProductGroup` draws.
  item: { borderTopColor: v3.colors.line, borderTopWidth: 1 },
  // 52 rather than a feature row's 62: a question has no square to make room
  // for, and eight of them should fit a thumb's scroll.
  question: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 52,
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[12],
  },
  pressed: { backgroundColor: v3.colors.line },
  // `minWidth: 0` lets a word longer than the row break instead of pushing
  // the chevron off the block — on the web a flex item will not shrink below
  // its longest word without it, and at the largest text sizes one is.
  questionText: {
    ...v3.type.callout,
    color: v3.colors.fg,
    flex: 1,
    fontWeight: '600',
    minWidth: 0,
  },
  answer: { paddingBottom: v3.space[14], paddingHorizontal: v3.space[14] },
  // In ink, not muted: the answer is what the row was opened to read.
  answerText: { ...v3.type.callout, color: v3.colors.fg },
}))
