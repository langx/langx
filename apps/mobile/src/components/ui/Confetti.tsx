import { useEffect, useMemo } from 'react'
import { StyleSheet, View, useWindowDimensions } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { rainDrops, type Drop, type RainStyle } from '../../lib/celebration'

/**
 * What falls: glyphs (the Pro welcome's emoji), or flat pieces of colour
 * (v3's, in the partner hues). The colours come from the caller's theme,
 * never from here, so a piece is the right shade in either scheme.
 */
export type ConfettiPieces =
  | { kind: 'glyph'; glyphs: readonly string[] }
  | { kind: 'flat'; colours: readonly string[] }

/**
 * One shower over the whole window, then gone. Decoration, not content:
 * never read out, never in the way of a tap — which is what lets a
 * celebration be skipped, or its button pressed, while it is still raining.
 *
 * Drawn only when motion is allowed. The caller leaves it out under reduced
 * motion rather than this deciding, because the caller also owns what
 * replaces it (a static card, and the haptic).
 *
 * Out of `ProWelcomeHost`, where it began as the emoji rain; the timing and
 * the pieces are the caller's (`RAIN` in `lib/celebration.ts`).
 */
export function Confetti({
  pieces,
  count,
  rain,
}: {
  pieces: ConfettiPieces
  count: number
  rain: RainStyle
}) {
  const { width, height } = useWindowDimensions()
  const drops = useMemo(() => rainDrops(count, width, rain), [count, width, rain])

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {drops.map((drop) => (
        <Piece key={drop.piece} drop={drop} pieces={pieces} fall={height + 120} />
      ))}
    </View>
  )
}

function Piece({ drop, pieces, fall }: { drop: Drop; pieces: ConfettiPieces; fall: number }) {
  const progress = useSharedValue(0)
  const { delay, fall: duration, spin } = drop

  // From an effect, never during render: a timing started before its view
  // existed froze part-way on the web build.
  useEffect(() => {
    progress.set(withDelay(delay, withTiming(1, { duration, easing: Easing.in(Easing.quad) })))
  }, [progress, delay, duration])

  const motion = useAnimatedStyle(() => ({
    // Invisible until it starts, and fading over the last fifth of the fall.
    opacity: progress.get() === 0 ? 0 : Math.min(1, (1 - progress.get()) * 5),
    transform: [
      { translateY: -60 + progress.get() * fall },
      { rotate: `${progress.get() * spin}deg` },
    ],
  }))

  const place = { position: 'absolute', start: drop.start, top: 0 } as const

  if (pieces.kind === 'glyph') {
    const glyph = pieces.glyphs[drop.piece % pieces.glyphs.length] ?? ''
    return <Animated.Text style={[place, { fontSize: drop.size }, motion]}>{glyph}</Animated.Text>
  }

  // Every third piece a dot, the rest strips: confetti is cut, not printed.
  const dot = drop.piece % 3 === 0
  const colour = pieces.colours[drop.piece % pieces.colours.length]
  return (
    <Animated.View
      style={[
        place,
        {
          backgroundColor: colour,
          borderRadius: dot ? drop.size : 2,
          height: dot ? drop.size * 0.7 : drop.size * 0.55,
          width: dot ? drop.size * 0.7 : drop.size,
        },
        motion,
      ]}
    />
  )
}
