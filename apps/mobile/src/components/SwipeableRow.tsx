import Feather from '@expo/vector-icons/Feather'
import { useEffect, type ReactNode } from 'react'
import { Platform, Pressable, Text, View, type AccessibilityActionEvent } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { makeStyles } from '../lib/theme'
import {
  ACTION_LOCK_PX,
  ACTION_WIDTH_PX,
  drawerWidth,
  rowSwipeEnabled,
  rowTranslation,
  settleOffset,
} from '../lib/swipeAction'

/**
 * Read once at module scope, like `MessageBubble` does, with the `typeof`
 * guard because `navigator` is absent while the web bundle is being exported.
 */
const HAS_TOUCH =
  Platform.OS !== 'web' || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)

export interface SwipeableRowAction {
  /** Also the accessibility action name, so it has to be stable and unique in the row. */
  id: string
  icon: keyof typeof Feather.glyphMap
  label: string
  colour: string
  /** Reads red, and is placed last so it is the furthest from a careless thumb. */
  destructive?: boolean
  onAction: () => void
}

interface SwipeableRowProps {
  /** Revealed by pulling the row to the right. */
  right: SwipeableRowAction[]
  /** Revealed by pulling the row to the left. */
  left: SwipeableRowAction[]
  /** The list owns this, so opening one row closes any other. */
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}

/**
 * A list row whose actions are behind it.
 *
 * **The drawer stays open and the buttons are tapped**, where this used to
 * commit on release. One action a side can be chosen by a gesture; two cannot,
 * because a single swipe has no way to say which was meant. It also puts a
 * destructive action behind a tap rather than behind a flick.
 *
 * Which row is open lives in the list, not here: two rows open at once is two
 * sets of buttons and no way to tell which the next tap belongs to.
 *
 * **gesture-handler and Reanimated, and it used to be `PanResponder` and
 * `Animated`.** That was not a tuning problem. `translateX.setValue` ran on
 * the JS thread for every finger move while the release spring ran with
 * `useNativeDriver: true` — the drag was bridge-bound and the settle was not,
 * so the row lagged behind the thumb and then caught up in one jump. The
 * capture threshold made it worse: 12px had to be travelled before anything
 * moved and nothing gave those 12px back, so the row started behind the finger
 * and stayed there.
 *
 * Now the pan is recognised natively (`activeOffsetX`/`failOffsetY`, which is
 * also what removes the dead zone), the offset is a shared value, and the
 * settle is a spring on the UI thread. The geometry stays in
 * `lib/swipeAction.ts`, still plain maths and still tested without a renderer —
 * it is worklet-safe as written.
 *
 * The cost is real and was argued against here for a year: Reanimated's
 * worklets bundle now enters the shipped web build. See `docs/decisions.md` →
 * *The row swipe runs on the UI thread*.
 *
 * Off for a mouse. `rowSwipeEnabled` states why; the actions are still reachable
 * through `accessibilityActions` and through whatever menu the row itself
 * offers, which on a desktop they always were.
 */
export function SwipeableRow({ right, left, open, onOpenChange, children }: SwipeableRowProps) {
  const styles = useStyles()
  /** Where the row is now, and where it is resting between gestures. */
  const translateX = useSharedValue(0)
  const restingAt = useSharedValue(0)

  const enabled = rowSwipeEnabled(Platform.OS, HAS_TOUCH)
  const rightWidth = drawerWidth(right.length)
  const leftWidth = drawerWidth(left.length)

  const settle = (to: number): void => {
    restingAt.value = to
    // `bounciness: 0`'s successor: a drawer that overshoots its own width
    // shows the row's background through the gap it opens.
    translateX.value = withSpring(to, { damping: 20, stiffness: 220, overshootClamping: true })
  }

  // The list closes this row by flipping `open`; the row is what animates.
  useEffect(() => {
    // `settle` touches two shared values, both stable, so it is deliberately
    // not a dependency — listing it would rebuild this on every render.
    if (!open && restingAt.value !== 0) settle(0)
  }, [open])

  const pan = Gesture.Pan()
    .enabled(enabled)
    /*
     * The capture rule, now native and now free of the dead zone.
     * `activeOffsetX` is the same 12px `shouldCaptureRowSwipe` used, but
     * gesture-handler reports `translationX` from where the gesture *began*
     * rather than from where it was recognised — so those first pixels are
     * given back and the row starts under the thumb rather than behind it.
     *
     * `failOffsetY` is the other half of what `HORIZONTAL_BIAS` was doing: a
     * flick that has gone further down than across is the list scrolling, and
     * failing rather than competing is what keeps the scroll smooth.
     */
    .activeOffsetX([-ACTION_LOCK_PX, ACTION_LOCK_PX])
    .failOffsetY([-ACTION_LOCK_PX, ACTION_LOCK_PX])
    .onUpdate((event) => {
      translateX.value = rowTranslation(restingAt.value + event.translationX, rightWidth, leftWidth)
    })
    .onEnd((event) => {
      const to = settleOffset(
        restingAt.value + event.translationX,
        rightWidth,
        leftWidth,
        event.velocityX,
      )
      restingAt.value = to
      translateX.value = withSpring(to, { damping: 20, stiffness: 220, overshootClamping: true })
      // The list's state lives in React, so crossing back costs one hop —
      // once, on release, rather than on every frame.
      runOnJS(onOpenChange)(to !== 0)
    })

  const movingStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }))

  /**
   * The actions again, for anyone not using a gesture. Swipe-only actions are
   * invisible to a screen reader, and this row had no accessibility of any kind
   * before.
   */
  const all = [...right, ...left]
  const onAccessibilityAction = (event: AccessibilityActionEvent): void => {
    all.find((action) => action.id === event.nativeEvent.actionName)?.onAction()
  }

  if (!enabled) return <>{children}</>

  return (
    <View style={styles.wrap}>
      <View style={styles.behind}>
        <View style={styles.drawer}>
          {right.map((action) => (
            <ActionButton key={action.id} action={action} styles={styles} />
          ))}
        </View>
        <View style={styles.drawer}>
          {left.map((action) => (
            <ActionButton key={action.id} action={action} styles={styles} />
          ))}
        </View>
      </View>
      {/*
        Opaque, and that is not decoration. `behind` is a child of `wrap`, so it
        paints over `wrap`'s background — the only one in the stack, since the
        chat row itself sets none. Without a background of its own this layer is
        glass, and the buttons sit visible on every row at rest with the row's
        own text printed on top of them.
      */}
      <GestureDetector gesture={pan}>
        <Animated.View
          accessibilityActions={all.map((action) => ({ name: action.id, label: action.label }))}
          onAccessibilityAction={onAccessibilityAction}
          style={[styles.moving, movingStyle]}
        >
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  )
}

function ActionButton({
  action,
  styles,
}: {
  action: SwipeableRowAction
  styles: ReturnType<typeof useStyles>
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={action.label}
      onPress={action.onAction}
      style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
    >
      <Feather name={action.icon} size={18} color={action.colour} />
      <Text style={[styles.actionLabel, { color: action.colour }]} numberOfLines={1}>
        {action.label}
      </Text>
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors, font }) => ({
  wrap: { backgroundColor: colors.bg, overflow: 'hidden' },
  moving: { backgroundColor: colors.bg },
  behind: {
    ...({ position: 'absolute' } as const),
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 0,
    right: 0,
    top: 0,
  },
  /** Each side's buttons, pinned to the edge they are reached from. */
  drawer: { flexDirection: 'row' },
  action: {
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 3,
    justifyContent: 'center',
    width: ACTION_WIDTH_PX,
  },
  actionPressed: { opacity: 0.6 },
  actionLabel: { ...font.caption, fontSize: 11, fontWeight: '600' },
}))
