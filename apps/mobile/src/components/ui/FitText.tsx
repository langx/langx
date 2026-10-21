import { useState, type ReactNode } from 'react'
import { Platform, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native'

interface FitTextProps {
  style: StyleProp<TextStyle>
  /** The smallest the type may go, as a share of its size: native's prop of the same name. */
  minimumFontScale: number
  children: ReactNode
}

/**
 * One line that shrinks to fit rather than ending in "…", on every platform.
 *
 * On iOS and Android this is `adjustsFontSizeToFit`. react-native-web does not
 * implement that prop, so on the web a long label — "Difficile" on a grade
 * tile, "Reproducción automática desactivada" on a pill — was cut off with an
 * ellipsis, which hides which button it is. The web half measures instead: an
 * invisible copy of the line reports its natural width, the room around it
 * reports its own, and the visible line takes the ratio of the two as its size,
 * never below `minimumFontScale`.
 */
export function FitText(props: FitTextProps) {
  if (Platform.OS === 'web') return <WebFitText {...props} />
  return (
    <Text
      style={props.style}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={props.minimumFontScale}
    >
      {props.children}
    </Text>
  )
}

function WebFitText({ style, minimumFontScale, children }: FitTextProps) {
  const [room, setRoom] = useState(0)
  const [natural, setNatural] = useState(0)
  const size = StyleSheet.flatten(style)?.fontSize
  const scale = room > 0 && natural > room ? Math.max(minimumFontScale, room / natural) : 1
  return (
    <View style={styles.room} onLayout={(event) => setRoom(event.nativeEvent.layout.width)}>
      <Text
        style={[style, size !== undefined && scale < 1 ? { fontSize: size * scale } : null]}
        numberOfLines={1}
      >
        {children}
      </Text>
      {/* Absolute and on one line, so its width is the line's whole natural width. */}
      <Text
        aria-hidden
        selectable={false}
        style={[style, styles.measure]}
        numberOfLines={1}
        onLayout={(event) => setNatural(event.nativeEvent.layout.width)}
      >
        {children}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  // Takes the place the line had: shrinks in a row, and centres the line both ways.
  room: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexShrink: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  measure: { left: 0, opacity: 0, pointerEvents: 'none', position: 'absolute', top: 0 },
})
