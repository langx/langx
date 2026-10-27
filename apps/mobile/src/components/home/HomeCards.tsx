import { useState, type ReactNode } from 'react'
import {
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { homeCardsBeside } from '../../lib/homeProducts'
import { makeStyles, useTheme, type V3Tokens } from '../../lib/theme'
import { useStacked } from '../product/ProductGroup'

/** A text a card prints, as it is drawn, so its longest word can be measured. */
export interface CardText {
  text: string
  style: StyleProp<TextStyle>
  maxScale: number
}

/**
 * Home's equal cards — the streak and Venus, and the four products — two to
 * a row while they fit, one to a row when they do not.
 *
 * "Fit" is measured rather than guessed from the phone's width, because it
 * depends on the words as much as on the room: every word the cards print is
 * drawn once, unseen, at its real size and face, and the cards go one to a
 * row when any word is wider than half a row leaves inside a card — so a
 * word is never broken in the middle, in any language. At the larger text
 * sizes (`useStacked`) they are one to a row whatever the words.
 *
 * One wrapping row rather than a row per pair, so a card keeps its place in
 * the tree when the layout changes and nothing it holds starts over. Cards on
 * one line stretch to the taller one, so a pair is always equal.
 *
 * `render` draws the cards for the layout chosen, each inside the `cell`
 * style it is handed.
 */
export function HomeCardRows({
  texts,
  render,
}: {
  texts: readonly CardText[]
  render: (layout: { beside: boolean; cell: StyleProp<ViewStyle> }) => ReactNode
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const stacked = useStacked()
  const [width, setWidth] = useState(0)
  const [measured, setMeasured] = useState<Readonly<Record<string, number>>>({})

  const words = texts.flatMap((item, index) =>
    item.text
      .split(/\s+/)
      .filter(Boolean)
      .map((word, at) => ({ key: `${index}:${at}:${word}`, word, item })),
  )
  // Only the words measured so far: one still on its way is not counted
  // against the layout until it has a width, so a line that changes (a
  // balance arriving) cannot flip the cards to a pair and back for a frame.
  const widths = words.flatMap((word) => {
    const value = measured[word.key]
    return value === undefined ? [] : [value]
  })
  const beside = homeCardsBeside({
    stacked,
    inner: width > 0 ? (width - v3.space[CARD_GAP]) / 2 - 2 * v3.space[CARD_INSET] : 0,
    words: widths,
  })

  const onWord = (key: string, value: number) =>
    setMeasured((current) => (current[key] === value ? current : { ...current, [key]: value }))

  return (
    <View
      style={styles.rows}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
    >
      {/* Only while the layout is still a question: one to a row is final. */}
      {stacked ? null : (
        <View
          style={styles.measure}
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {words.map(({ key, word, item }) => (
            <View
              key={key}
              style={styles.measured}
              onLayout={(event: LayoutChangeEvent) => onWord(key, event.nativeEvent.layout.width)}
            >
              <Text style={item.style} maxFontSizeMultiplier={item.maxScale}>
                {word}
              </Text>
            </View>
          ))}
        </View>
      )}
      {render({ beside, cell: beside ? styles.half : styles.whole })}
    </View>
  )
}

/**
 * The inset inside every card on each side, as a step of `v3.space` — Home's
 * other blocks are inset by the same 14 — so a card's padding and the room
 * this measures against are the one number.
 */
export const CARD_INSET = 14 satisfies keyof V3Tokens['space']

/** Between two cards, across and down. */
const CARD_GAP = 10 satisfies keyof V3Tokens['space']

const useStyles = makeStyles(({ v3 }) => ({
  rows: { flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[CARD_GAP] },
  // Two to a line: each grows from a basis under half to share the line
  // evenly, whatever the gap, and the next pair wraps.
  half: { flexBasis: '40%', flexGrow: 1, minWidth: 0 },
  whole: { flexBasis: '100%' },
  // Out of the layout and unseen; each word hugs its own width.
  measure: {
    alignItems: 'flex-start',
    opacity: 0,
    pointerEvents: 'none',
    position: 'absolute',
    start: 0,
    top: 0,
  },
  measured: { alignSelf: 'flex-start' },
}))
