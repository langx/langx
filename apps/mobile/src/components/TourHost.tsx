import { router } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { useT, type MessageKey } from '../i18n'
import { track } from '../lib/analytics'
import { makeStyles } from '../lib/theme'
import {
  advance,
  currentStep,
  hasTourTarget,
  isLastStep,
  measureTourTarget,
  progress,
  resolveFrom,
  setTourState,
  subscribeToTour,
  tourBodyKey,
  tourCta,
  TOUR_TABS,
  type TourRect,
  type TourState,
} from '../lib/tour'
import { tourLayout } from '../lib/tourLayout'
import { Button } from './ui/Button'

/** Long enough for the tab that was just switched to to have drawn itself. */
const SETTLE_MS = 260
/**
 * How long a step keeps asking for its target before giving up on it.
 *
 * A target on a tab that has never been opened does not exist until the
 * navigation lands, and the first measurement after `router.navigate` can
 * still find nothing. One attempt was enough on Discovery and wrong the moment
 * the run started moving between tabs: each unmeasurable step advanced
 * immediately, so the whole tail of the tour played itself out in a second.
 */
const MEASURE_RETRIES = 8
const RETRY_MS = 150

/**
 * Draws whatever run `src/lib/tour.ts` has open: the screen dimmed, one real
 * element left lit, and a bubble beside it.
 *
 * A `Modal`, for the three reasons written at the top of `MessageMenuHost` —
 * `measureInWindow` and a full-screen Modal are both in window coordinates so
 * they agree; a Modal paints above the tab bar on every platform without
 * depending on mount order; and `onRequestClose` is Android's back button,
 * which here means "I have seen enough".
 *
 * Nothing here knows what a step *means*. The order, the skipping and the
 * counting are `tour.ts`, the rectangles are `tourLayout.ts`, and the sentences
 * are the catalogue — this file is the paint.
 */
export function TourHost() {
  const styles = useStyles()
  const t = useT()
  const screen = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const reduceMotion = useReduceMotion()

  const [state, setState] = useState<TourState | null>(null)
  const [anchor, setAnchor] = useState<TourRect | null>(null)

  useEffect(() => subscribeToTour(setState), [])

  const step = state ? currentStep(state) : undefined
  const target = step?.target

  const finish = useCallback(
    (reason: 'completed' | 'skipped', at: TourState, openedProfile = false) => {
      const shown = currentStep(at)
      track(
        reason === 'completed'
          ? {
              name: 'tour_completed',
              properties: { is_guest: at.guest, opened_profile: openedProfile },
            }
          : {
              name: 'tour_skipped',
              properties: { step: shown?.target ?? 'discoverPair', index: at.index },
            },
      )
      setTourState(null)
      /*
       * Sent away three tabs from where the run started, somebody is standing
       * on a screen they did not choose. The run borrowed the navigation, so
       * it gives it back — except when the offer was taken, which is a
       * destination of its own.
       */
      if (!openedProfile && shown?.tab && shown.tab !== TOUR_TABS.discover) {
        router.navigate(TOUR_TABS.discover)
      }
    },
    [],
  )

  const goNext = useCallback(() => {
    if (!state) return
    const next = resolveFrom(advance(state), hasTourTarget)
    if (next) setTourState(next)
    else finish('completed', state)
  }, [finish, state])

  /*
   * Measured per step rather than once, and again when the window changes
   * size: the list scrolls, the chip row appears, a phone rotates. A step
   * whose target cannot be measured — unmounted since the run started, or
   * laid out at zero size — is skipped rather than drawn as an empty ring.
   */
  useEffect(() => {
    if (!state || !step || !target) return
    let cancelled = false
    setAnchor(null)
    const index = state.index

    /*
     * A step that names a tab switches to it first, and then waits a moment
     * before measuring — not because the anchor moves (the bar is mounted on
     * every tab) but because the reader should see the screen arrive before
     * being told what it is. Switching and speaking in the same frame reads as
     * a glitch.
     */
    if (step.tab) router.navigate(step.tab)

    let timer: ReturnType<typeof setTimeout>
    const attempt = (left: number): void => {
      timer = setTimeout(
        () => {
          void measureTourTarget(target).then((rect) => {
            if (cancelled) return
            if (!rect) return left > 0 ? attempt(left - 1) : goNext()
            setAnchor(rect)
            // Counted here rather than in an effect on `anchor`, so a
            // re-measure after a rotation is not a second view of one step.
            track({ name: 'tour_step_viewed', properties: { step: target, index } })
          })
        },
        left === MEASURE_RETRIES && step.tab ? SETTLE_MS : left === MEASURE_RETRIES ? 0 : RETRY_MS,
      )
    }
    attempt(MEASURE_RETRIES)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // `state` itself is safe to depend on: it only ever gets a new identity
    // when the run actually moves, because nothing publishes without changing.
  }, [goNext, screen.height, screen.width, state, step, target])

  if (!state || !step) return null

  const layout = anchor ? tourLayout({ anchor, screen, insets }) : null
  const { current, total } = progress(state)
  const last = isLastStep(state)
  /*
   * The offer only stands on the last step, and only while the screen still
   * has something to offer. Everything before it is being explained, not
   * chosen between, and two committing buttons in one run would make the tour
   * a sequence of decisions.
   */
  const cta = last ? tourCta() : null

  return (
    <Modal
      visible
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      statusBarTranslucent
      accessibilityViewIsModal
      onRequestClose={() => finish('skipped', state)}
    >
      <View style={StyleSheet.absoluteFill}>
        {/*
          The dim is one pressable, and pressing it moves on: an overlay that
          only listens to its own button teaches people to hunt for the button.
          It is a *sibling* of the bubble rather than its parent, and that is
          not a detail — react-native-web renders a pressable with a button
          role as a real `<button>`, and the Skip and Next buttons inside one
          are nested buttons, which is invalid HTML and breaks hydration. The
          panels above it are `pointerEvents="none"`, so a tap on the dim still
          lands here.
        */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={goNext}
          accessibilityRole="button"
          accessibilityLabel={t('tour.next')}
        />
        {layout ? (
          <>
            {/* The dim and the hole are one view: see `tourLayout`. */}
            <View
              pointerEvents="none"
              style={[
                styles.mask,
                layout.mask,
                { borderRadius: layout.border.radius, borderWidth: layout.border.width },
              ]}
            />
            <View
              pointerEvents="none"
              style={[
                styles.ring,
                {
                  left: layout.hole.x,
                  top: layout.hole.y,
                  width: layout.hole.width,
                  height: layout.hole.height,
                  borderRadius: layout.hole.radius,
                },
              ]}
            />
          </>
        ) : // Before the first measurement answers there is nothing to cut
        // out, and a screen that dims a moment before the hole appears reads
        // as a load rather than as a flash.
        null}

        {layout ? (
          <View
            style={[
              styles.bubble,
              {
                left: layout.bubble.left,
                width: layout.bubble.width,
                maxHeight: layout.bubble.maxHeight,
              },
              layout.bubble.placement === 'below'
                ? { top: layout.bubble.top }
                : { bottom: layout.bubble.bottom },
            ]}
          >
            <ScrollView
              contentContainerStyle={styles.bubbleInner}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.counter}>{t('tour.progress', { current, total })}</Text>
              <Text style={styles.title}>{t(`tour.${step.target}Title` as MessageKey)}</Text>
              <Text style={styles.body}>{t(tourBodyKey(step.target, state) as MessageKey)}</Text>
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => finish('skipped', state)}
                  hitSlop={12}
                  style={({ pressed }) => [pressed && styles.pressed]}
                >
                  <Text style={styles.skip}>{cta ? t('tour.notNow') : t('tour.skip')}</Text>
                </Pressable>
                <Button
                  label={
                    cta
                      ? t('tour.sayHi', { name: cta.name })
                      : last
                        ? t('tour.done')
                        : t('tour.next')
                  }
                  onPress={() => {
                    if (!cta) return goNext()
                    // Closed before the profile opens, not after: the screen
                    // under the overlay is about to be replaced, and a Modal
                    // still up over it is a dim nobody can dismiss.
                    finish('completed', state, true)
                    cta.run()
                  }}
                  size="small"
                  // `Button` spans its column by default, which is wrong in a
                  // row — its own doc comment says to pass this here.
                  style={styles.next}
                />
              </View>
            </ScrollView>
          </View>
        ) : null}
      </View>
    </Modal>
  )
}

const useStyles = makeStyles(({ colors, radius, spacing }) => ({
  mask: { borderColor: colors.scrim, position: 'absolute' },
  /**
   * A ring, not a fill: the element underneath is the real one, still drawn by
   * the screen below — this only says which one it is.
   */
  ring: { borderColor: colors.accent, borderWidth: 2, position: 'absolute' },
  bubble: {
    backgroundColor: colors.bg,
    borderRadius: radius.xl,
    position: 'absolute',
  },
  bubbleInner: { gap: spacing.sm, padding: spacing.lg },
  counter: { color: colors.textFaint, fontSize: 12, fontWeight: '600' },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  body: { color: colors.textMuted, fontSize: 15, lineHeight: 21 },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  skip: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
  next: { width: 'auto' },
  pressed: { opacity: 0.6 },
}))
