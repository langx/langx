import Feather from '@expo/vector-icons/Feather'
import { useRef, type ReactNode } from 'react'
import { Animated, PanResponder, Platform, Text, View } from 'react-native'
import { makeStyles } from '../lib/theme'
import {
  rowReleased,
  rowSwipeEnabled,
  rowTranslation,
  shouldCaptureRowSwipe,
} from '../lib/swipeAction'

/**
 * Read once at module scope, like `MessageBubble` does, with the `typeof`
 * guard because `navigator` is absent while the web bundle is being exported.
 */
const HAS_TOUCH =
  Platform.OS !== 'web' || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)

export interface SwipeableRowAction {
  icon: keyof typeof Feather.glyphMap
  label: string
  colour: string
  onAction: () => void
}

interface SwipeableRowProps {
  /** Revealed by swiping right. */
  right: SwipeableRowAction
  /** Revealed by swiping left. */
  left: SwipeableRowAction
  children: ReactNode
}

/**
 * A list row that can be swiped either way to act on it.
 *
 * **Swipe and release, not a drawer that stays open.** A row that stays open
 * needs a shared "which row is open" across the whole list, and there is no
 * precedent for that here — `MessageBubble`'s swipe always springs back. This
 * is the same gesture that file already proved, given a second direction, and
 * it means a row can never be left in a state the reader has to undo.
 *
 * RN's `PanResponder` and `Animated`, not gesture-handler and not Reanimated:
 * `react-native-gesture-handler` is not a dependency at all (only a transitive
 * peer of expo-router's drawer, unreachable under pnpm's isolated layout), and
 * `ui/Skeleton.tsx` records why pulling Reanimated in would put its worklets
 * bundle into the shipped web build.
 *
 * Off for a mouse. `rowSwipeEnabled` states why; the long-press menu on the row
 * is the way in on a desktop, which it already was.
 */
export function SwipeableRow({ right, left, children }: SwipeableRowProps) {
  const styles = useStyles()
  const translateX = useRef(new Animated.Value(0)).current
  // Read during the gesture without re-rendering the row on every frame.
  const offset = useRef(0)

  const enabled = rowSwipeEnabled(Platform.OS, HAS_TOUCH)

  const pan = useRef(
    PanResponder.create({
      // Never on start: that would swallow the tap that opens the thread and
      // the long press that opens the menu.
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_event, gesture) =>
        enabled && shouldCaptureRowSwipe(gesture.dx, gesture.dy),
      // The list asking for the responder back mid-scroll wins, always.
      onPanResponderTerminationRequest: () => true,
      onPanResponderMove: (_event, gesture) => {
        offset.current = gesture.dx
        translateX.setValue(rowTranslation(gesture.dx))
      },
      onPanResponderRelease: () => {
        const fired = rowReleased(offset.current)
        offset.current = 0
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 0,
        }).start()
        if (fired === 'right') right.onAction()
        if (fired === 'left') left.onAction()
      },
      onPanResponderTerminate: () => {
        offset.current = 0
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start()
      },
    }),
  ).current

  if (!enabled) return <>{children}</>

  return (
    <View style={styles.wrap}>
      {/*
        Both actions sit behind the row at once, each pinned to the side it is
        reached from. The row itself hides whichever one is not being pulled
        towards, so there is nothing to toggle and nothing to get out of step.
      */}
      <View style={styles.behind} pointerEvents="none">
        <Action action={right} align="flex-start" styles={styles} />
        <Action action={left} align="flex-end" styles={styles} />
      </View>
      <Animated.View style={{ transform: [{ translateX }] }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  )
}

function Action({
  action,
  align,
  styles,
}: {
  action: SwipeableRowAction
  align: 'flex-start' | 'flex-end'
  styles: ReturnType<typeof useStyles>
}) {
  return (
    <View style={[styles.action, { alignItems: align }]}>
      <Feather name={action.icon} size={18} color={action.colour} />
      <Text style={[styles.actionLabel, { color: action.colour }]} numberOfLines={1}>
        {action.label}
      </Text>
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  wrap: { backgroundColor: colors.bg, overflow: 'hidden' },
  behind: {
    ...({ position: 'absolute' } as const),
    alignItems: 'center',
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 0,
    paddingHorizontal: spacing.lg,
    right: 0,
    top: 0,
  },
  action: { gap: 2, justifyContent: 'center' },
  actionLabel: { ...font.caption, fontSize: 11, fontWeight: '600' },
}))
