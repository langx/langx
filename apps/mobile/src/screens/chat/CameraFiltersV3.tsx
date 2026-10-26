import { useEffect, useMemo, useRef } from 'react'
import { I18nManager, Pressable, ScrollView, Text, useWindowDimensions } from 'react-native'
import { Gesture } from 'react-native-gesture-handler'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useT, type MessageKey } from '../../i18n'
import {
  CAMERA_FILTER_IDS,
  filterIndexAfterSwipe,
  type CameraFilterId,
} from '../../lib/cameraFilters'
import { makeStyles } from '../../lib/theme'
import { DURATION, TIMING } from '../../lib/theme/motion'

/*
 * The chat camera's filters in the redesign's look: the strip of names under
 * the viewfinder, the name that flashes over the picture when it changes, and
 * the sideways swipe that changes it. Literal colours, as in `SnapCameraV3`:
 * the stage is black in both schemes.
 */
const ON_STAGE = '#ffffff'
const SCRIM = 'rgba(12, 13, 16, 0.62)'
const INK = '#14161b'

/** How long the name stays up before it fades. */
const NAME_HOLD_MS = 700

export const FILTER_LABEL: Record<CameraFilterId, MessageKey> = {
  original: 'viewOnce.filterOriginal',
  warm: 'viewOnce.filterWarm',
  cool: 'viewOnce.filterCool',
  mono: 'viewOnce.filterMono',
  vivid: 'viewOnce.filterVivid',
  film: 'viewOnce.filterFilm',
}

/**
 * A one-finger sideways swipe on the picture: the next filter or the one
 * before, round the ends (`filterIndexAfterSwipe`). It only starts once the finger has
 * clearly gone sideways and gives up if it goes up or down first, and a
 * second finger makes it the pinch's instead, so it races the zoom's
 * gestures without taking either from them.
 */
export function useFilterSwipe({
  enabled,
  filter,
  onFilter,
}: {
  enabled: boolean
  filter: CameraFilterId
  onFilter: (next: CameraFilterId) => void
}) {
  // Read at the swipe's end, so the gesture need not be rebuilt for each filter.
  const latest = useRef({ filter, onFilter })
  latest.current = { filter, onFilter }
  return useMemo(
    () =>
      Gesture.Pan()
        .maxPointers(1)
        .activeOffsetX([-16, 16])
        .failOffsetY([-16, 16])
        .enabled(enabled)
        .runOnJS(true)
        .onEnd((event) => {
          const index = CAMERA_FILTER_IDS.indexOf(latest.current.filter)
          const next = filterIndexAfterSwipe({
            index,
            count: CAMERA_FILTER_IDS.length,
            translationX: event.translationX,
            velocityX: event.velocityX,
            rtl: I18nManager.isRTL,
          })
          const id = CAMERA_FILTER_IDS[next]
          if (next !== index && id) latest.current.onFilter(id)
        }),
    [enabled],
  )
}

/**
 * The filter's name in the middle of the picture, shown each time `token`
 * changes and faded out after a moment. Reduced motion shows and hides it
 * without the fade.
 */
export function FilterNameFlash({ filter, token }: { filter: CameraFilterId; token: number }) {
  const t = useT()
  const styles = useStyles()
  const reduce = useReduceMotion()
  const shown = useSharedValue(0)
  // The token a mount starts with is not a change: the preview opening on a
  // filter picked on the viewfinder flashes nothing.
  const seen = useRef(token)

  useEffect(() => {
    if (token === seen.current) return
    seen.current = token
    const hold = reduce ? DURATION.fade + NAME_HOLD_MS : NAME_HOLD_MS
    shown.set(
      withSequence(
        withTiming(1, reduce ? { duration: 0 } : TIMING.press),
        withDelay(hold, withTiming(0, reduce ? { duration: 0 } : TIMING.fade)),
      ),
    )
  }, [token, reduce, shown])

  const fade = useAnimatedStyle(() => ({ opacity: shown.get() }))

  return (
    <Animated.View
      style={[styles.flash, fade]}
      pointerEvents="none"
      // The strip's radio already says which filter is on.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={styles.flashText}>{t(FILTER_LABEL[filter])}</Text>
    </Animated.View>
  )
}

/**
 * The filters by name, in a row that scrolls sideways, the chosen one white.
 * Tapping a name picks it, as swiping the picture does; either way the
 * chosen one is brought into view.
 */
export function FilterStrip({
  filter,
  onFilter,
}: {
  filter: CameraFilterId
  onFilter: (next: CameraFilterId) => void
}) {
  const t = useT()
  const styles = useStyles()
  const reduce = useReduceMotion()
  const window = useWindowDimensions()
  const scroll = useRef<ScrollView>(null)
  const spots = useRef<Partial<Record<CameraFilterId, { x: number; width: number }>>>({})

  function bringIntoView(id: CameraFilterId, animated: boolean): void {
    const spot = spots.current[id]
    if (!spot) return
    scroll.current?.scrollTo({
      x: Math.max(0, spot.x + spot.width / 2 - window.width / 2),
      animated,
    })
  }

  useEffect(() => {
    bringIntoView(filter, !reduce)
    // Only a change of filter scrolls; `bringIntoView` reads refs and the width.
  }, [filter, reduce])

  return (
    <ScrollView
      ref={scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.strip}
      contentContainerStyle={styles.stripRow}
      accessibilityRole="radiogroup"
      accessibilityLabel={t('viewOnce.filters')}
    >
      {CAMERA_FILTER_IDS.map((id) => {
        const on = id === filter
        return (
          <Pressable
            key={id}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => onFilter(id)}
            onLayout={(event) => {
              const { x, width } = event.nativeEvent.layout
              spots.current[id] = { x, width }
              // Mounted again after a retake: open on the chosen one, not the start.
              if (id === filter) bringIntoView(id, false)
            }}
            hitSlop={{ top: 6, bottom: 6 }}
            style={({ pressed }) => [styles.pill, on && styles.pillOn, pressed && styles.pressed]}
          >
            <Text style={[styles.pillLabel, on && styles.pillLabelOn]} numberOfLines={1}>
              {t(FILTER_LABEL[id])}
            </Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  flash: {
    alignItems: 'center',
    bottom: 0,
    end: 0,
    justifyContent: 'center',
    position: 'absolute',
    start: 0,
    top: 0,
  },
  flashText: {
    ...v3.type.title,
    color: ON_STAGE,
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  strip: { alignSelf: 'stretch', flexGrow: 0 },
  stripRow: { gap: v3.space[8], paddingHorizontal: v3.space[4] },
  pill: {
    alignItems: 'center',
    backgroundColor: SCRIM,
    borderRadius: v3.radius.pill,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: v3.space[14],
  },
  pillOn: { backgroundColor: ON_STAGE },
  pressed: { opacity: 0.8 },
  pillLabel: { ...v3.type.label, color: ON_STAGE },
  pillLabelOn: { color: INK },
}))
