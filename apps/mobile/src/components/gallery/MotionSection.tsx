import { useState } from 'react'
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { ADMIN } from '../../lib/adminStrings'
import { makeStyles } from '../../lib/theme'
import { DURATION, PRESS_SCALE, SPRING, TIMING, unlessReduced } from '../../lib/theme/motion'
import type { GallerySectionEntry } from './GallerySection'
import { V3Plate } from './GallerySection'

const DOT = 28

type Play = (to: number) => number

const TIMINGS = (Object.keys(TIMING) as (keyof typeof TIMING)[]).map((name) => ({
  name,
  label: ADMIN.gallery.motion.timing(name, DURATION[name]),
  play: ((to) => withTiming(to, TIMING[name])) satisfies Play,
}))

const SPRINGS = (Object.keys(SPRING) as (keyof typeof SPRING)[]).map((name) => ({
  name,
  label: ADMIN.gallery.motion.spring(name),
  play: ((to) => withSpring(to, SPRING[name])) satisfies Play,
}))

function MotionBody() {
  const styles = useStyles()
  const reduce = useReduceMotion()
  return (
    <V3Plate>
      {reduce ? <Text style={styles.note}>{ADMIN.gallery.motion.reduced}</Text> : null}
      {[...TIMINGS, ...SPRINGS].map((preset) => (
        <Preset key={preset.label} label={preset.label} play={preset.play} reduce={reduce} />
      ))}
      <PressSample reduce={reduce} />
    </V3Plate>
  )
}

/**
 * A dot that crosses its track and back, one leg per tap, under one preset —
 * so a spring's overshoot shows as the dot passing its stop.
 */
function Preset({ label, play, reduce }: { label: string; play: Play; reduce: boolean }) {
  const styles = useStyles()
  const progress = useSharedValue(0)
  const travel = useSharedValue(0)
  const [atEnd, setAtEnd] = useState(false)

  // The track's own width, so the dot stops at its end on any screen. Read
  // on the JS thread and handed over once per layout, not per frame.
  const onLayout = (event: LayoutChangeEvent): void => {
    travel.set(Math.max(0, event.nativeEvent.layout.width - DOT))
  }

  const onPress = (): void => {
    const to = atEnd ? 0 : 1
    setAtEnd(!atEnd)
    progress.set(unlessReduced(reduce, to, play))
  }

  const dot = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.get() * travel.get() }],
  }))

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.track} onLayout={onLayout}>
        <Animated.View style={[styles.dot, dot]} />
      </View>
    </Pressable>
  )
}

/** The press: shrinks while held, lets go quicker than it went in. */
function PressSample({ reduce }: { reduce: boolean }) {
  const styles = useStyles()
  const scale = useSharedValue(1)
  const pressed = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }))
  return (
    <View style={styles.pressRow}>
      <Text style={styles.label}>{ADMIN.gallery.motion.pressScale(PRESS_SCALE)}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={ADMIN.gallery.motion.press}
        onPressIn={() =>
          scale.set(unlessReduced(reduce, PRESS_SCALE, (to) => withTiming(to, TIMING.press)))
        }
        onPressOut={() =>
          scale.set(unlessReduced(reduce, 1, (to) => withTiming(to, TIMING.release)))
        }
      >
        <Animated.View style={[styles.pill, pressed]}>
          <Text style={styles.pillText}>{ADMIN.gallery.motion.press}</Text>
        </Animated.View>
      </Pressable>
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  note: { ...v3.type.callout, color: v3.colors.muted },
  label: { ...v3.type.label, color: v3.colors.fg, paddingBottom: v3.space[4] },
  // Laid out left to right in every locale: a transform is not mirrored, so
  // under a right-to-left layout the dot would start on the right and leave
  // its track. A demo of a curve has no reading direction.
  track: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    direction: 'ltr',
    height: DOT,
  },
  dot: {
    backgroundColor: v3.colors.blue,
    borderRadius: v3.radius.pill,
    height: DOT,
    width: DOT,
  },
  pressRow: { gap: v3.space[4], paddingTop: v3.space[8] },
  pill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: v3.colors.pill,
    borderRadius: v3.radius.pill,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: v3.space[24],
  },
  pillText: { ...v3.type.headline, color: v3.colors.pillText },
}))

export const motionSection: GallerySectionEntry = {
  key: 'motion',
  title: ADMIN.gallery.motion.title,
  hint: ADMIN.gallery.motion.hint,
  Body: MotionBody,
}
