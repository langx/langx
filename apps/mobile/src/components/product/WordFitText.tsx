import { Text, type TextProps } from 'react-native'
import { useWordFit, WidestWord } from './WidestWord'

type WordFitTextProps = Omit<TextProps, 'children' | 'maxFontSizeMultiplier'> & {
  /** The line's role's cap in `PRODUCT_TEXT_SCALE`. */
  cap: number
  children: string
}

/**
 * A line of a product page that grows with the reader's text size up to its
 * role's cap and no further than keeps its widest word whole on the line it
 * has (`useWordFit`). In the place of a `Text`, with the same style.
 *
 * The fixed caps are set for English on a 375pt phone, and the other seven
 * languages have longer words: at the largest size "Присоединяйтесь" and
 * "Sicherheitsrichtlinie" broke in the middle of a row's title, which no cap
 * that leaves English its size could have prevented. Below the cap, at every
 * size up to where the word would no longer fit, nothing changes.
 *
 * A compound may still break after its hyphens, as it does at the default
 * size ("Ende-zu-Ende-|verschlüsselt"), so its parts are measured, not the
 * whole: holding "Ende-zu-Ende-verschlüsselt?" on one line would shrink the
 * whole question for a break every reader already knows.
 */
export function WordFitText({ cap, children, style, onLayout, ...rest }: WordFitTextProps) {
  const fit = useWordFit(cap)
  return (
    <>
      <WidestWord text={children.replace(/-/g, '-\n')} style={style} onWidth={fit.setWidest} />
      <Text
        {...rest}
        style={style}
        maxFontSizeMultiplier={fit.scale}
        onLayout={(event) => {
          fit.setLine(event.nativeEvent.layout.width)
          onLayout?.(event)
        }}
      >
        {children}
      </Text>
    </>
  )
}
