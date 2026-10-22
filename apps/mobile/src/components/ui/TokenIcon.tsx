import { Fragment, type ReactNode } from 'react'
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
} from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { splitTokenMarks, tokenIconMetrics } from '../../lib/tokenAmount'
import { useTheme } from '../../lib/theme'

/** The four-pointed spark the store has always drawn, a little fuller in the waist. */
const SPARK = 'M12 2.5L14.8 9.2L21.5 12L14.8 14.8L12 21.5L9.2 14.8L2.5 12L9.2 9.2Z'

/**
 * The token, drawn: the redesign's unit for every amount ("+23 ✦"), in place
 * of the word. A spark and not a coin (`docs/token-messaging-brief.md`), and
 * always in the colour of the number it follows, like "%" or "$": a hue of
 * its own made every amount look like a link, and blue is the colour of
 * things to tap. The thin stroke in the same colour only rounds the points.
 *
 * Decoration on its own — whatever draws it beside a number says the unit
 * aloud (`TokenText`, `tokenAmountLabel`).
 */
export function TokenIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path d={SPARK} fill={color} stroke={color} strokeWidth={1.2} strokeLinejoin="round" />
    </Svg>
  )
}

/**
 * The pieces of a sentence with `TOKEN_MARK`s in it, for a `Text` to hold: the
 * words as they are, and an inline icon wherever a marker was, sized from the
 * sentence's font and sat on its baseline. For a component that owns its own
 * `Text` and label (`Button`); everything else wants `TokenText`.
 */
export function tokenMarkChildren(text: string, fontSize: number, color: string): ReactNode {
  const { size, gap, drop } = tokenIconMetrics(fontSize)
  const parts = splitTokenMarks(text)
  return parts.map((part, index) => (
    <Fragment key={index}>
      {index > 0 ? (
        <View
          style={{
            height: size,
            // The gap goes on whichever side touches the number, not a word's space.
            paddingStart: /\S$/.test(parts[index - 1] ?? '') ? gap : 0,
            paddingEnd: /^\S/.test(part) ? gap : 0,
            transform: [{ translateY: drop }],
          }}
        >
          <TokenIcon size={size} color={color} />
        </View>
      ) : null}
      {part}
    </Fragment>
  ))
}

/**
 * A sentence with token amounts in it, the icon drawn wherever the screen put
 * `TOKEN_MARK` (`tokenSlot`, `tokenSentence`). One element to a screen
 * reader, which hears `label` — the sentence with the unit in words.
 *
 * The icon rides inside the text as an inline view, so it wraps with the
 * words around it and inherits the line rather than a row's guess at it.
 */
export function TokenText({
  text,
  label,
  style,
  ...rest
}: {
  text: string
  label: string
  style?: StyleProp<TextStyle>
} & Omit<TextProps, 'style' | 'children' | 'accessibilityLabel'>) {
  const { v3 } = useTheme()
  const flat = StyleSheet.flatten(style)
  const fontSize = flat?.fontSize ?? 16
  // The icon takes the text's colour; a style without one is the ground's text.
  const color = typeof flat?.color === 'string' ? flat.color : v3.colors.fg
  return (
    <Text accessible accessibilityLabel={label} style={style} {...rest}>
      {tokenMarkChildren(text, fontSize, color)}
    </Text>
  )
}
