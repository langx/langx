import Feather from '@expo/vector-icons/Feather'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  Image,
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import markArcs from '../../../assets/brand/mark-arcs.png'
import markTile from '../../../assets/brand/logo-rounded.png'
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useLocale, useT } from '../../i18n'
import { impact } from '../../lib/haptics'
import {
  isYearRecap,
  recapSlides,
  swipeIntent,
  tapDirection,
  type RecapSlide,
  type StoryRecap,
} from '../../lib/recapStory'
import { DISPLAY_FONT, useTheme } from '../../lib/theme'
import { Button } from '../ui/Button'
import { RISE_DELAYS, Rise } from './motion'
import { Slide, slideLook } from './RecapSlides'

/**
 * How long a slide holds before the next one. The design says about three
 * seconds; the longest line lands 1.3s in, so three and a half leaves time to
 * read it rather than to watch it leave.
 */
const SLIDE_MS = 3500

/** The story's widest column: on a desktop browser it is a phone, centred. */
const MAX_WIDTH = 480

const MARK = { arcs: markArcs, tile: markTile }

export interface RecapStoryProps {
  recap: StoryRecap
  /** Capitalised, in the reader's language — or, for a year, the year. */
  month: string
  /** Empty for a year, whose headline already is one. */
  year: string
  me: { handle: string; displayName: string; avatarUrl?: string; _id: string } | undefined
  /** "Spanish → learning Turkish", or nothing. */
  languages?: string
  /** Nunito Black, once it has loaded. */
  blackFont?: string
  onClose: () => void
  /** The last slide's button: the summary poster. */
  onShare: () => void
  /** Any other slide's share button: a card of that slide. */
  onShareSlide: (slide: RecapSlide) => void
  /** Held still while something is open over it — the share sheet. */
  paused: boolean
  onJustLink: () => void
  /** Once, as the story goes away: how far it got. */
  onViewed: (seen: { slides: number; completed: boolean }) => void
}

/**
 * "Your Month" — the recap as a story of full-screen slides.
 *
 * Tap the far third to go back and anywhere else to go on; hold to pause;
 * swipe across to step and down to leave. Each slide advances by itself after
 * `SLIDE_MS` except the last, which is the share card and waits. Every
 * other slide can be shared on its own from the button beside Close, and the
 * story holds still while the sheet for it is open.
 *
 * **Auto-advance is off under reduced motion and with a screen reader.** A
 * timer that moves the page on is motion of its own, and it takes the page
 * away from somebody still listening to it; both get the story as plain
 * pages, with Previous and Next as real buttons for the screen reader.
 *
 * Everything that moves runs on the UI thread — the progress fill, the ground
 * colour, the drag — and React hears about a gesture once, when it ends.
 */
export function RecapStory(props: RecapStoryProps) {
  const { recap, onClose } = props
  const t = useT()
  const { locale, isRtl } = useLocale()
  const { scheme } = useTheme()
  const reduce = useReduceMotion()
  const screenReader = useScreenReader()
  const insets = useSafeAreaInsets()
  const window = useWindowDimensions()

  const slides = useRef(recapSlides(recap)).current
  const [index, setIndex] = useState(0)
  const slide = slides[index] ?? 'summary'
  const last = index === slides.length - 1
  const autoplay = !reduce && !screenReader
  const look = slideLook(slide, scheme)

  const width = Math.min(window.width, MAX_WIDTH)
  // The design was drawn at 390×844. Smaller phones scale down to fit the
  // height as well as the width — an iPhone SE is 667 tall — and nothing grows
  // past a tenth over the drawing, however large the window.
  const k = Math.min(width / 390, (window.height - insets.top - insets.bottom) / 760, 1.1)
  const gutter = 28 * k

  // How far the story got, for `recap_story_viewed` when it goes.
  const seen = useRef(0)
  seen.current = Math.max(seen.current, index + 1)
  const onViewed = useRef(props.onViewed)
  onViewed.current = props.onViewed
  useEffect(
    () => () =>
      onViewed.current({ slides: seen.current, completed: seen.current >= slides.length }),
    [slides.length],
  )

  const step = useCallback(
    (direction: 'previous' | 'next') => {
      setIndex((current) => {
        const next = direction === 'next' ? current + 1 : current - 1
        return Math.max(0, Math.min(slides.length - 1, next))
      })
    },
    [slides.length],
  )

  // A tap is a user action and gets a tick; the timer's advance does not.
  const tap = useCallback(
    (direction: 'previous' | 'next') => {
      void impact('light')
      step(direction)
    },
    [step],
  )

  // Moves on only from the slide whose timer ran out. A timer that finishes
  // just as the reader taps elsewhere would otherwise carry them one further.
  const advanceFrom = useCallback(
    (from: number) => {
      setIndex((current) => (current === from ? Math.min(slides.length - 1, current + 1) : current))
    },
    [slides.length],
  )

  const progress = useSharedValue(0)
  /*
   * The fill is read and written on the UI thread only. Read from React it
   * was the last value React had seen, not the bar on screen: back from the
   * share slide that was its full bar, so the slide before it got a timer of
   * no length and was skipped straight back to the end.
   *
   * `restart` starts the slide's fill from empty; without it a resume after a
   * hold carries on from where the fill stopped.
   */
  const run = useCallback(
    (from: number, restart: boolean) => {
      scheduleOnUI(() => {
        'worklet'
        cancelAnimation(progress)
        if (restart) progress.value = 0
        const remaining = (1 - progress.value) * SLIDE_MS
        progress.value = withTiming(
          1,
          { duration: remaining, easing: Easing.linear },
          (finished) => {
            if (finished) scheduleOnRN(advanceFrom, from)
          },
        )
      })
    },
    [progress, advanceFrom],
  )

  useEffect(() => {
    if (!last && autoplay) {
      run(index, true)
      return
    }
    scheduleOnUI(() => {
      'worklet'
      cancelAnimation(progress)
      progress.value = 1
    })
  }, [index, last, autoplay, progress, run])

  // Only a hold that began resumes: `onFinalize` also fires for a press that
  // never became one, and that press has already moved the story on.
  const held = useRef(false)
  const pause = useCallback(() => {
    held.current = true
    scheduleOnUI(() => {
      'worklet'
      cancelAnimation(progress)
    })
  }, [progress])
  const resume = useCallback(() => {
    if (!held.current) return
    held.current = false
    if (!last && autoplay) run(index, false)
  }, [index, last, autoplay, run])

  // The share sheet is a hold the reader did not have to keep a finger on:
  // the slide they are sharing should still be there when it closes.
  const { paused } = props
  useEffect(() => {
    if (paused) pause()
    else resume()
  }, [paused, pause, resume])

  // The ground cross-fades rather than cuts: 500ms, as designed.
  const ground = useSharedValue(look.ground)
  useEffect(() => {
    ground.value = reduce
      ? look.ground
      : withTiming(look.ground, { duration: 500, easing: Easing.bezier(0.2, 0.8, 0.2, 1) })
  }, [look.ground, reduce, ground])
  const groundStyle = useAnimatedStyle(() => ({ backgroundColor: ground.value }))

  // Dragging down takes the whole story with the finger; far or fast enough
  // and it closes, otherwise it springs home.
  const drag = useSharedValue(0)
  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: drag.value }],
    opacity: 1 - Math.min(drag.value / 600, 0.4),
  }))

  const pan = Gesture.Pan()
    .minDistance(12)
    .onUpdate((event) => {
      if (event.translationY > 0 && Math.abs(event.translationY) > Math.abs(event.translationX)) {
        drag.value = event.translationY
      }
    })
    .onEnd((event) => {
      const intent = swipeIntent(
        event.translationX,
        event.translationY,
        event.velocityX,
        event.velocityY,
        isRtl,
      )
      if (intent === 'close') {
        scheduleOnRN(onClose)
        return
      }
      drag.value = withSpring(0, { duration: 400, dampingRatio: 0.8, velocity: event.velocityY })
      if (intent) scheduleOnRN(tap, intent)
    })

  const hold = Gesture.LongPress().minDuration(180).runOnJS(true).onStart(pause).onFinalize(resume)

  const press = Gesture.Tap()
    .maxDuration(250)
    .runOnJS(true)
    .onEnd((event) => tap(tapDirection(event.x, width, isRtl)))

  const gesture = Gesture.Race(pan, Gesture.Exclusive(hold, press))

  // The web build's keyboard: arrows step (mirrored in Arabic, as the page
  // is), space pauses, Escape leaves.
  useEffect(() => {
    if (Platform.OS !== 'web') return
    const target = globalThis as unknown as {
      addEventListener: (type: string, fn: (event: KeyboardEvent) => void) => void
      removeEventListener: (type: string, fn: (event: KeyboardEvent) => void) => void
    }
    let paused = false
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'ArrowRight') step(isRtl ? 'previous' : 'next')
      else if (event.key === 'ArrowLeft') step(isRtl ? 'next' : 'previous')
      else if (event.key === 'Escape') onClose()
      else if (event.key === ' ') {
        event.preventDefault()
        paused = !paused
        if (paused) pause()
        else resume()
      }
    }
    target.addEventListener('keydown', onKey)
    return () => target.removeEventListener('keydown', onKey)
  }, [isRtl, step, onClose, pause, resume])

  const black = props.blackFont ?? DISPLAY_FONT

  return (
    <Animated.View testID="recap-story" style={[{ alignItems: 'center', flex: 1 }, groundStyle]}>
      <StatusBar style={look.bar} />
      <Animated.View style={[{ flex: 1, width }, dragStyle]}>
        <GestureDetector gesture={gesture}>
          <View
            style={{
              flex: 1,
              overflow: 'hidden',
              paddingBottom: insets.bottom + (last ? 150 : 56) * k,
              paddingHorizontal: gutter,
              paddingTop: insets.top + 96 * k,
            }}
          >
            <Slide
              key={slide}
              slide={slide}
              scheme={scheme}
              recap={recap}
              look={look}
              t={t}
              locale={locale}
              rtl={isRtl}
              reduce={reduce}
              k={k}
              width={width - gutter * 2}
              black={black}
              display={DISPLAY_FONT}
              month={props.month}
              year={props.year}
              me={props.me}
              {...(props.languages ? { languages: props.languages } : {})}
            />
          </View>
        </GestureDetector>

        {/* The chrome sits above the slide and outside the gesture, so the
            close button and the share buttons are buttons and not taps. */}
        <View
          pointerEvents="box-none"
          style={{
            left: 16 * k,
            position: 'absolute',
            right: 16 * k,
            top: insets.top + 10,
          }}
        >
          <View style={{ flexDirection: 'row', gap: 5 }}>
            {slides.map((each, at) => (
              <ProgressBar
                key={each}
                state={at < index ? 'done' : at === index ? 'current' : 'todo'}
                progress={progress}
                ink={look.ink}
                track={look.track}
              />
            ))}
          </View>
          <View
            pointerEvents="box-none"
            style={{
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginTop: 14,
              paddingHorizontal: 4 * k,
            }}
          >
            <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
              <Image
                source={MARK[look.mark]}
                style={{ height: 22, width: 22 }}
                accessibilityIgnoresInvertColors
              />
              <Text style={{ color: look.ink, fontFamily: DISPLAY_FONT, fontSize: 17 }}>LangX</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {/* The last slide has its own, larger share button. */}
              {last ? null : (
                <ChromeButton
                  icon="share"
                  label={t('recap.story.shareSlide')}
                  look={look}
                  onPress={() => props.onShareSlide(slide)}
                />
              )}
              <ChromeButton icon="x" label={t('recap.story.close')} look={look} onPress={onClose} />
            </View>
          </View>
        </View>

        {last ? (
          <View
            pointerEvents="box-none"
            style={{
              bottom: insets.bottom + 20 * k,
              gap: 10,
              left: gutter,
              position: 'absolute',
              right: gutter,
            }}
          >
            <Rise delay={RISE_DELAYS[3]} reduce={reduce} style={{ gap: 10 }}>
              <Button
                label={isYearRecap(recap) ? t('recap.year.share') : t('recap.share')}
                onPress={props.onShare}
              />
              <Pressable
                accessibilityRole="button"
                onPress={props.onJustLink}
                style={({ pressed }) => ({
                  alignItems: 'center',
                  height: 48,
                  justifyContent: 'center',
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                })}
              >
                <Text style={{ color: look.ink, fontFamily: DISPLAY_FONT, fontSize: 15 }}>
                  {t('recap.story.justLink')}
                </Text>
              </Pressable>
            </Rise>
          </View>
        ) : null}

        {!autoplay && screenReader ? (
          <View
            style={{
              bottom: insets.bottom + (last ? 150 : 8) * k,
              flexDirection: 'row',
              justifyContent: 'space-between',
              left: gutter,
              position: 'absolute',
              right: gutter,
            }}
          >
            <StepButton
              label={t('recap.story.previous')}
              ink={look.ink}
              disabled={index === 0}
              onPress={() => step('previous')}
            />
            <Text style={{ alignSelf: 'center', color: look.muted }}>
              {t('recap.story.slideOf', { index: index + 1, total: slides.length })}
            </Text>
            <StepButton
              label={t('recap.story.next')}
              ink={look.ink}
              disabled={last}
              onPress={() => step('next')}
            />
          </View>
        ) : null}
      </Animated.View>
    </Animated.View>
  )
}

/** A round glyph button in the story's top row. */
function ChromeButton({
  icon,
  label,
  look,
  onPress,
}: {
  icon: 'x' | 'share'
  label: string
  look: { chrome: string; ink: string }
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: look.chrome,
        borderRadius: 18,
        height: 36,
        justifyContent: 'center',
        transform: [{ scale: pressed ? 0.94 : 1 }],
        width: 36,
      })}
    >
      <Feather name={icon} size={icon === 'x' ? 18 : 16} color={look.ink} />
    </Pressable>
  )
}

/**
 * One segment of the progress row. Only the current one moves, and it moves
 * by `width` — absolutely positioned and childless, so animating it lays
 * nothing else out, and a left-to-right fill turns around in Arabic by itself.
 */
function ProgressBar({
  state,
  progress,
  ink,
  track,
}: {
  state: 'done' | 'current' | 'todo'
  progress: SharedValue<number>
  ink: string
  track: string
}) {
  const current = state === 'current'
  const fill = useAnimatedStyle(() => ({
    width: `${(current ? progress.value : state === 'done' ? 1 : 0) * 100}%`,
  }))
  return (
    <View
      style={{ backgroundColor: track, borderRadius: 3, flex: 1, height: 3, overflow: 'hidden' }}
    >
      <Animated.View
        style={[{ backgroundColor: ink, bottom: 0, position: 'absolute', start: 0, top: 0 }, fill]}
      />
    </View>
  )
}

function StepButton({
  label,
  ink,
  disabled,
  onPress,
}: {
  label: string
  ink: string
  disabled: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ justifyContent: 'center', minHeight: 44, paddingHorizontal: 12 }}
    >
      <Text style={{ color: ink, fontFamily: DISPLAY_FONT, fontSize: 15 }}>{label}</Text>
    </Pressable>
  )
}

/** Whether a screen reader is on, kept current while the story is open. */
function useScreenReader(): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => {
    // A browser cannot tell, and react-native-web answers `true` regardless —
    // which stopped the story and put buttons on it for everybody. The web
    // build's keyboard steps through it instead.
    if (Platform.OS === 'web') return
    let cancelled = false
    void AccessibilityInfo.isScreenReaderEnabled().then((value) => {
      if (!cancelled) setOn(value)
    })
    // Optional for the same reason as in `useReduceMotion`: RNW returns
    // nothing without `matchMedia`.
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setOn) as
      { remove: () => void } | undefined
    return () => {
      cancelled = true
      subscription?.remove()
    }
  }, [])
  return on
}
