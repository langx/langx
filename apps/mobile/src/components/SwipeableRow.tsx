import Feather from '@expo/vector-icons/Feather'
import { useEffect, useRef, type ReactNode } from 'react'
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  Text,
  View,
  type AccessibilityActionEvent,
} from 'react-native'
import { makeStyles } from '../lib/theme'
import {
  ACTION_WIDTH_PX,
  drawerWidth,
  rowSwipeEnabled,
  rowTranslation,
  settleOffset,
  shouldCaptureRowSwipe,
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
 * RN's `PanResponder` and `Animated`, not gesture-handler and not Reanimated:
 * `react-native-gesture-handler` is not a dependency at all (only a transitive
 * peer of expo-router's drawer, unreachable under pnpm's isolated layout), and
 * `ui/Skeleton.tsx` records why pulling Reanimated in would put its worklets
 * bundle into the shipped web build.
 *
 * Off for a mouse. `rowSwipeEnabled` states why; the actions are still reachable
 * through `accessibilityActions` and through whatever menu the row itself
 * offers, which on a desktop they always were.
 */
export function SwipeableRow({ right, left, open, onOpenChange, children }: SwipeableRowProps) {
  const styles = useStyles()
  const translateX = useRef(new Animated.Value(0)).current
  /**
   * Where the row is resting. Read during the gesture without re-rendering,
   * and — unlike the old version, which only ever started from zero — added to
   * `gesture.dx`, because `dx` is measured from the start of *this* drag and an
   * already-open row would otherwise jump back to nearly closed on the second.
   */
  const restingAt = useRef(0)

  const enabled = rowSwipeEnabled(Platform.OS, HAS_TOUCH)
  const rightWidth = drawerWidth(right.length)
  const leftWidth = drawerWidth(left.length)

  /** Kept fresh for the responder, which is built once and closes over nothing else. */
  const geometry = useRef({ rightWidth, leftWidth, onOpenChange })
  geometry.current = { rightWidth, leftWidth, onOpenChange }

  const settle = (to: number): void => {
    restingAt.current = to
    Animated.spring(translateX, { toValue: to, useNativeDriver: true, bounciness: 0 }).start()
  }

  // The list closes this row by flipping `open`; the row is what animates.
  useEffect(() => {
    // `settle` touches two refs and one `Animated.Value`, all stable, so it is
    // deliberately not a dependency — listing it would rebuild this on every
    // render and close the row mid-gesture.
    if (!open && restingAt.current !== 0) settle(0)
  }, [open])

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
        const { rightWidth: r, leftWidth: l } = geometry.current
        translateX.setValue(rowTranslation(restingAt.current + gesture.dx, r, l))
      },
      onPanResponderRelease: (_event, gesture) => {
        const { rightWidth: r, leftWidth: l, onOpenChange: notify } = geometry.current
        const to = settleOffset(restingAt.current + gesture.dx, r, l)
        settle(to)
        notify(to !== 0)
      },
      onPanResponderTerminate: () => {
        settle(restingAt.current)
      },
    }),
  ).current

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
      <Animated.View
        accessibilityActions={all.map((action) => ({ name: action.id, label: action.label }))}
        onAccessibilityAction={onAccessibilityAction}
        style={[styles.moving, { transform: [{ translateX }] }]}
        {...pan.panHandlers}
      >
        {children}
      </Animated.View>
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
