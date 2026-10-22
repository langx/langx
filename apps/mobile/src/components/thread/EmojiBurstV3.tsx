import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import {
  BURST_MS,
  burstPlan,
  burstRandom,
  type BurstCopy,
  type BurstEase,
  type BurstParticle,
} from '../../lib/emojiBurst'

export interface Burst {
  /** One to three distinct emoji, as `burstEmoji` gives them. */
  emoji: string[]
  /** The message's, so a replay draws the same shower its first play did. */
  seed: string
  /** New for every burst, so a replay mounts afresh. */
  key: number
}

/**
 * A big emoji's shower over the whole thread, then gone (see
 * `lib/emojiBurst.ts` for when it plays and how each emoji moves).
 *
 * Decoration, not content: never read out and never in the way of a touch,
 * so the composer keeps working and the list keeps scrolling under it.
 *
 * One clock for the whole burst rather than one per copy: a single timing on
 * the UI thread, and each copy works out its own place from it in a worklet.
 * Nothing runs on the JS thread between the first frame and the last, which
 * is what keeps it smooth while a message is also landing in the list.
 */
export function EmojiBurstV3({ burst, onDone }: { burst: Burst; onDone: () => void }) {
  /*
   * Worked out from the layer's own size, not the window's: on a wide web
   * layout the thread is one panel of several, and a burst sized to the
   * window would throw from the wrong place. Set once, at the first layout,
   * so a rotation mid-shower does not re-roll it; the caller keys this by
   * `burst.key`, so every burst mounts afresh.
   */
  const [copies, setCopies] = useState<BurstCopy[] | null>(null)
  const clock = useSharedValue(0)

  // From an effect, never during render: a timing started before its view
  // existed froze part-way on the web build (see `Confetti`).
  useEffect(() => {
    clock.set(withTiming(BURST_MS, { duration: BURST_MS, easing: Easing.linear }))
    // A timer rather than the timing's callback: it ends the burst on the web
    // and in a backgrounded app alike, where a frame callback may never come.
    const timer = setTimeout(onDone, BURST_MS + 50)
    return () => clearTimeout(timer)
  }, [clock, onDone])

  return (
    <View
      pointerEvents="none"
      style={styles.layer}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout
        setCopies(
          (drawn) => drawn ?? burstPlan(burst.emoji, width, height, burstRandom(burst.seed)),
        )
      }}
    >
      {copies?.map((copy, index) => (
        <Copy
          key={index}
          emoji={copy.emoji}
          particle={copy.particle}
          eases={copy.eases}
          clock={clock}
        />
      ))}
    </View>
  )
}

function Copy({
  emoji,
  particle,
  eases,
  clock,
}: {
  emoji: string
  particle: BurstParticle
  eases: { x: BurstEase; y: BurstEase }
  clock: SharedValue<number>
}) {
  const motion = useAnimatedStyle(() => {
    const { delay, duration, x0, y0, dx, dy, gravity, sway, waves, phase, spin } = particle
    const raw = (clock.get() - delay) / duration
    if (raw <= 0 || raw >= 1)
      return { opacity: 0, transform: [{ translateX: x0 }, { translateY: y0 }] }
    const p = raw
    const ease = (kind: BurstEase) =>
      kind === 'in' ? p * p : kind === 'out' ? 1 - (1 - p) * (1 - p) : p
    // In over the first tenth; out over the last 300 ms of its own run, so
    // nothing leaves the screen at full strength.
    const opacity = Math.min(1, p * 10, ((1 - p) * duration) / 300)
    return {
      opacity,
      transform: [
        { translateX: x0 + dx * ease(eases.x) + sway * Math.sin(Math.PI * 2 * waves * p + phase) },
        { translateY: y0 + dy * ease(eases.y) + gravity * p * p },
        { rotate: `${spin * p}deg` },
        { scale: 1 + (particle.endScale - 1) * p },
      ],
    }
  })

  return (
    <Animated.Text style={[styles.copy, { fontSize: particle.size }, motion]}>
      {emoji}
    </Animated.Text>
  )
}

const styles = StyleSheet.create({
  /*
   * Over the header and the composer as well as the list. The zIndex is what
   * keeps it there: without it a sibling with its own layer paints on top.
   */
  layer: {
    bottom: 0,
    elevation: 24,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 24,
  },
  // Absolute at the top-left corner, so `translate` alone places it. Physical
  // left, not `start`: the paths are worked out in screen coordinates.
  copy: { left: 0, position: 'absolute', top: 0 },
})
