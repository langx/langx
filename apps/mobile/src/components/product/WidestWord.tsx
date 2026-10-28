import { useState } from 'react'
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native'
import { wordFitScale } from '../../lib/productPage'

/**
 * How far a line whose words are not known in advance may grow with the
 * reader's text size (`wordFitScale`): `cap`, or less where its widest word
 * would not fit the line whole. Give `setLine` the width the line has and
 * `setWidest` what `WidestWord` measured, and pass `scale` to the line's
 * `maxFontSizeMultiplier`.
 */
export function useWordFit(cap: number): {
  scale: number
  setLine: (width: number) => void
  setWidest: (width: number) => void
} {
  const [line, setLine] = useState(0)
  const [widest, setWidest] = useState(0)
  return { scale: wordFitScale(line, widest, cap), setLine, setWidest }
}

/**
 * `text` once more, a word to a line, at the default size, unseen and out of
 * the layout, so its width is the widest word's (`useWordFit`). Place it
 * inside the box the line is in: out of the flow, it moves nothing there,
 * and a word wider than that box is measured at the box's width, which never
 * takes the line under the default size. Hidden from every screen reader
 * and from touch.
 *
 * The column of words is held in a box of no height that clips it, so it
 * never reaches past what it sits in: on the web, a column that ran past the
 * end of the page made the page that much longer.
 */
export function WidestWord({
  text,
  style,
  onWidth,
}: {
  text: string
  style: StyleProp<TextStyle>
  onWidth: (width: number) => void
}) {
  return (
    <View
      style={styles.measure}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text
        style={style}
        allowFontScaling={false}
        onLayout={(event) => onWidth(event.nativeEvent.layout.width)}
      >
        {text.split(/\s+/).join('\n')}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  measure: {
    height: 0,
    opacity: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
    position: 'absolute',
    start: 0,
    top: 0,
  },
})
