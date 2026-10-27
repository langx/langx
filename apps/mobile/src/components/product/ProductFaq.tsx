import Feather from '@expo/vector-icons/Feather'
import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useT } from '../../i18n'
import { makeStyles, useTheme } from '../../lib/theme'
import { TIMING, unlessReduced } from '../../lib/theme/motion'
import { Reveal } from '../paywall/Reveal'
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
 * A list between hairlines, on the ground like the rest of the page: the
 * rules are what make a stack of questions scannable, and a grey block round
 * them would add nothing the rules do not.
 *
 * One open at a time. Opening a second closes the first, so the page never
 * grows into a wall of answers the reader has to scroll back past. Each
 * question is a button whose expanded state the platform announces — "collapsed",
 * "expanded" — so no words of ours are needed for it. The answer rises in
 * under its question and the chevron turns; with reduce motion on, neither
 * moves and the answer is simply there.
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
  const styles = useStyles()
  const [open, setOpen] = useState<string | null>(null)

  return (
    <ProductSection title={title ?? t('productPage.questions')}>
      <View style={styles.list}>
        {items.map((item) => (
          <QuestionRow
            key={item.key}
            item={item}
            open={open === item.key}
            onToggle={() => setOpen((current) => (current === item.key ? null : item.key))}
          />
        ))}
      </View>
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
  const reduce = useReduceMotion()
  const turn = useSharedValue(open ? 1 : 0)

  // Started from an effect, never from render: see `lib/theme/motion`.
  useEffect(() => {
    turn.set(unlessReduced(reduce, open ? 1 : 0, (to) => withTiming(to, TIMING.fill)))
  }, [open, reduce, turn])

  const chevron = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.get() * 180}deg` }],
  }))

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={item.question}
        onPress={onToggle}
        style={({ pressed }) => [styles.question, pressed && styles.pressed]}
      >
        <Text style={styles.questionText}>{item.question}</Text>
        <Animated.View style={chevron}>
          <Feather name="chevron-down" size={v3.icon.md} color={v3.colors.muted} />
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
  // A rule under the heading and under every row, so the first question is
  // fenced like the rest and the list visibly ends.
  list: { borderTopColor: v3.colors.line, borderTopWidth: 1 },
  row: { borderBottomColor: v3.colors.line, borderBottomWidth: 1 },
  question: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 56,
    paddingVertical: v3.space[14],
  },
  // A row on the ground dims rather than shrinks, as Me's lines on the ground do.
  pressed: { opacity: 0.7 },
  // `minWidth: 0` lets a word longer than the row break instead of pushing
  // the chevron off the screen — on the web a flex item will not shrink below
  // its longest word without it, and at the largest text sizes one is.
  questionText: {
    ...v3.type.body,
    color: v3.colors.fg,
    flex: 1,
    fontWeight: '600',
    minWidth: 0,
  },
  // Clear of the chevron's column, so an answer never runs under the mark
  // that closes it.
  answer: { paddingBottom: v3.space[16], paddingEnd: v3.space[32] },
  // In ink, not muted: the answer is what the row was opened to read.
  answerText: { ...v3.type.callout, color: v3.colors.fg },
}))
