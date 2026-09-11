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
  type TourRect,
  type TourState,
} from '../lib/tour'
import { tourLayout } from '../lib/tourLayout'
import { Button } from './ui/Button'

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

  const finish = useCallback((reason: 'completed' | 'skipped', at: TourState) => {
    const shown = currentStep(at)
    track(
      reason === 'completed'
        ? { name: 'tour_completed', properties: { is_guest: at.guest } }
        : {
            name: 'tour_skipped',
            properties: { step: shown?.target ?? 'discoverPair', index: at.index },
          },
    )
    setTourState(null)
  }, [])

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
    if (!state || !target) return
    let cancelled = false
    setAnchor(null)
    const index = state.index
    void measureTourTarget(target).then((rect) => {
      if (cancelled) return
      if (!rect) return goNext()
      setAnchor(rect)
      // Counted here rather than in an effect on `anchor`, so a re-measure
      // after a rotation is not a second view of the same step.
      track({ name: 'tour_step_viewed', properties: { step: target, index } })
    })
    return () => {
      cancelled = true
    }
    // `state` itself is safe to depend on: it only ever gets a new identity
    // when the run actually moves, because nothing publishes without changing.
  }, [goNext, screen.height, screen.width, state, target])

  if (!state || !step) return null

  const layout = anchor ? tourLayout({ anchor, screen, insets }) : null
  const { current, total } = progress(state)
  const last = isLastStep(state)

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
            {layout.panels.map((panel, index) => (
              <View
                key={index}
                pointerEvents="none"
                style={[styles.panel, { left: panel.x, top: panel.y, ...sized(panel) }]}
              />
            ))}
            <View
              pointerEvents="none"
              style={[
                styles.ring,
                { left: layout.hole.x, top: layout.hole.y, ...sized(layout.hole) },
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
              <Text style={styles.title}>{t(`tour.${target}Title` as MessageKey)}</Text>
              <Text style={styles.body}>{t(`tour.${target}Body` as MessageKey)}</Text>
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => finish('skipped', state)}
                  hitSlop={12}
                  style={({ pressed }) => [pressed && styles.pressed]}
                >
                  <Text style={styles.skip}>{t('tour.skip')}</Text>
                </Pressable>
                <Button
                  label={last ? t('tour.done') : t('tour.next')}
                  onPress={goNext}
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

/** Rects come out of the layout as x/y/width/height; styles want the last two. */
function sized(rect: TourRect): { width: number; height: number } {
  return { width: rect.width, height: rect.height }
}

const useStyles = makeStyles(({ colors, radius, spacing }) => ({
  panel: { backgroundColor: colors.scrim, position: 'absolute' },
  /**
   * A ring, not a fill: the element underneath is the real one, still drawn by
   * the screen below — this only says which one it is.
   */
  ring: {
    borderColor: colors.accent,
    borderRadius: radius.lg,
    borderWidth: 2,
    position: 'absolute',
  },
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
