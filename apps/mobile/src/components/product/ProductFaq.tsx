import Feather from '@expo/vector-icons/Feather'
import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useT } from '../../i18n'
import { makeStyles, useTheme } from '../../lib/theme'
import { SPRING, unlessReduced } from '../../lib/theme/motion'
import { Reveal } from '../paywall/Reveal'
import { ProductSection } from './ProductSection'
import { useToneColors, type ProductTone } from './tone'

export interface ProductQuestion {
  key: string
  question: string
  /** Checked against the code before it is written; numbers from `packages/shared`, never typed. */
  answer: string
}

/** The plus's disc. Not text, so it keeps its size whatever the reader's text size. */
const DISC = 32

/**
 * How far a question grows with the reader's text size. It shares its line
 * with the disc, and past 2× one word of it — "cryptocurrency?" — is wider
 * than what is left of a 375pt phone and breaks in the middle. The answer
 * under it has the card's whole width and grows in full.
 */
const QUESTION_MAX_SCALE = 2

/**
 * The questions at the foot of every product page (plan item 7): six to eight,
 * then the product's own site for the rest.
 *
 * Each question is its own card, as a chat bubble is its own shape, rather
 * than a row in a list: a page of questions should read as things people ask,
 * not as settings. A plus in the page's colour turns into a cross when the
 * answer is open, so what pressing it again does is drawn on it.
 *
 * One open at a time. Opening a second closes the first, so the page never
 * grows into a wall of answers the reader has to scroll back past. Each
 * question is a button whose expanded state the platform announces — "collapsed",
 * "expanded" — so no words of ours are needed for it. With reduce motion on,
 * the plus and the answer do not move; the answer is simply there.
 */
export function ProductFaq({
  tone,
  items,
  title,
}: {
  tone: ProductTone
  items: readonly ProductQuestion[]
  /** The section's heading. "Questions and answers" unless a page needs its own. */
  title?: string
}) {
  const t = useT()
  const styles = useStyles()
  const [open, setOpen] = useState<string | null>(null)

  return (
    <ProductSection title={title ?? t('productPage.questions')}>
      <View style={styles.list}>
        {items.map((item) => (
          <QuestionCard
            key={item.key}
            tone={tone}
            item={item}
            open={open === item.key}
            onToggle={() => setOpen((current) => (current === item.key ? null : item.key))}
          />
        ))}
      </View>
    </ProductSection>
  )
}

function QuestionCard({
  tone,
  item,
  open,
  onToggle,
}: {
  tone: ProductTone
  item: ProductQuestion
  open: boolean
  onToggle: () => void
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const { ground, on } = useToneColors(tone)
  const reduce = useReduceMotion()
  const turn = useSharedValue(open ? 1 : 0)

  // Started from an effect, never from render: see `lib/theme/motion`. A
  // choice landing, so `select`'s small overshoot: the tap carried the intent.
  useEffect(() => {
    turn.set(unlessReduced(reduce, open ? 1 : 0, (to) => withSpring(to, SPRING.select)))
  }, [open, reduce, turn])

  // Three eighths of a turn: the plus's arms land on the diagonals, a cross.
  const plus = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get() * 135}deg` }] }))

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={item.question}
        onPress={onToggle}
        style={({ pressed }) => [styles.question, pressed && styles.pressed]}
      >
        <Text style={styles.questionText} maxFontSizeMultiplier={QUESTION_MAX_SCALE}>
          {item.question}
        </Text>
        <Animated.View style={[styles.disc, { backgroundColor: ground }, plus]}>
          <Feather name="plus" size={v3.icon.sm} color={on} />
        </Animated.View>
      </Pressable>
      {open ? (
        <Reveal index={0} style={styles.answer}>
          <Text style={styles.answerText}>{item.answer}</Text>
        </Reveal>
      ) : null}
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  list: { gap: v3.space[8] },
  card: { backgroundColor: v3.colors.surface, borderRadius: v3.radius.row, overflow: 'hidden' },
  question: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[12],
    paddingHorizontal: v3.space[16],
    paddingVertical: v3.space[14],
  },
  // The grey rows' own press, as `MeRows` draws it: a card dims its ground and
  // does not shrink.
  pressed: { backgroundColor: v3.colors.line },
  // `minWidth: 0` lets a word longer than the row break instead of pushing
  // the plus off the card — on the web a flex item will not shrink below
  // its longest word without it, and at the largest text sizes one is.
  // In the display face, as a button's label is: a question is something to
  // press, and it should not read as small print.
  questionText: { ...v3.type.button, color: v3.colors.fg, flex: 1, minWidth: 0 },
  disc: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    height: DISC,
    justifyContent: 'center',
    width: DISC,
  },
  answer: { paddingBottom: v3.space[16], paddingHorizontal: v3.space[16] },
  // In ink, not muted, and at body size: the answer is what the card was
  // opened to read.
  answerText: { ...v3.type.body, color: v3.colors.fg },
}))
