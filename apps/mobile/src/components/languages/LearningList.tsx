import Feather from '@expo/vector-icons/Feather'
import type { LanguageLevel } from '@langx/shared'
import { useLayoutEffect, type ReactNode } from 'react'
import { View, type AccessibilityActionEvent, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { useDisplayNames, useT } from '../../i18n'
import { LIFT_AFTER_MS, dropIndex, makeRoom, slotOffset } from '../../lib/dragReorder'
import { impact } from '../../lib/haptics'
import { makeStyles, useTheme } from '../../lib/theme'

export type LearningEntry = { code: string; level: LanguageLevel }

/**
 * How the rows and the handle are drawn, for the one thing the two looks of
 * the languages screen draw differently: the current look's defaults, or the
 * redesign's grey block and its bigger handle. Everything that moves is the
 * same code in both.
 */
export interface LearningListLook {
  /** Under each row, so the one lifted over its neighbours hides them. */
  ground?: string | undefined
  handle?: ViewStyle | undefined
  handleColor?: string | undefined
}

/** What every learning row reads while one of them is held. */
interface Drag {
  /** The index being dragged, or -1 when none is. */
  from: SharedValue<number>
  /** Where it would land if it were dropped now. */
  to: SharedValue<number>
  /** How far it has been moved from its own slot. */
  dy: SharedValue<number>
  /** Every row's measured height, by index. */
  heights: SharedValue<number[]>
}

/**
 * The learning list, reordered by holding the ≡ and dragging.
 *
 * It replaced a pair of arrows on every row, which cost a tap for every row
 * crossed and put two more small targets beside each ×. A drag says where in
 * one gesture.
 *
 * The rows stay in the list's own layout and only *look* moved: the dragged one
 * follows the finger and its neighbours step aside by its height, all of it
 * transforms on the UI thread. Nothing is written until the drop, which is one
 * edit naming the row it landed on. The transforms are cleared in a layout
 * effect keyed on the order, so they come off as the new order is drawn rather
 * than before it — clearing them at the drop would show the old order for as
 * long as the optimistic write takes to reach the cache.
 *
 * Screen readers get the arrows back as actions on the handle — a drag they
 * cannot see is not a way to reorder anything.
 */
export function LearningList({
  learning,
  onMove,
  renderRow,
  look,
}: {
  learning: LearningEntry[]
  onMove: (code: string, to: number) => boolean
  renderRow: (entry: LearningEntry, handle: ReactNode) => ReactNode
  look?: LearningListLook | undefined
}) {
  const drag: Drag = {
    from: useSharedValue(-1),
    to: useSharedValue(-1),
    dy: useSharedValue(0),
    heights: useSharedValue<number[]>([]),
  }

  function settle(): void {
    drag.from.set(-1)
    drag.to.set(-1)
    drag.dy.set(0)
  }

  const order = learning.map((entry) => entry.code).join(',')
  // The shared values are stable, so `order` is the only thing this follows.
  useLayoutEffect(settle, [order])

  function drop(from: number, to: number): void {
    const entry = learning[from]
    // Refused, or a no-op: the list will not redraw, so nothing else clears it.
    if (!entry || !onMove(entry.code, to)) settle()
  }

  return (
    <>
      {learning.map((entry, index) => (
        <DraggableRow
          key={entry.code}
          entry={entry}
          index={index}
          count={learning.length}
          drag={drag}
          onDrop={drop}
          onMove={onMove}
          renderRow={renderRow}
          look={look}
        />
      ))}
    </>
  )
}

function DraggableRow({
  entry,
  index,
  count,
  drag,
  onDrop,
  onMove,
  renderRow,
  look,
}: {
  entry: LearningEntry
  index: number
  count: number
  drag: Drag
  onDrop: (from: number, to: number) => void
  onMove: (code: string, to: number) => boolean
  renderRow: (entry: LearningEntry, handle: ReactNode) => ReactNode
  look?: LearningListLook | undefined
}) {
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()
  const names = useDisplayNames()
  const name = names.language(entry.code)

  const lift = (): void => void impact('light')

  const pan = Gesture.Pan()
    .activateAfterLongPress(LIFT_AFTER_MS)
    .onStart(() => {
      drag.from.set(index)
      drag.to.set(index)
      drag.dy.set(0)
      runOnJS(lift)()
    })
    .onUpdate((event) => {
      drag.dy.set(event.translationY)
      // Sliced, because a removed row's height is left behind at the end.
      drag.to.set(dropIndex(drag.heights.get().slice(0, count), index, event.translationY))
    })
    .onEnd((_event, success) => {
      // The list redrew under the finger — a failed write rolled back — and
      // this index no longer names the row that was picked up.
      if (drag.from.get() !== index) return
      // Cancelled rather than released — the system took the touch — goes home.
      const to = success ? drag.to.get() : index
      const rest = slotOffset(drag.heights.get().slice(0, count), index, to)
      drag.dy.set(
        withTiming(rest, { duration: 150 }, (finished) => {
          if (finished) runOnJS(onDrop)(index, to)
        }),
      )
    })

  const moving = useAnimatedStyle(() => {
    const from = drag.from.get()
    if (from === -1) {
      return { transform: [{ translateY: 0 }], zIndex: 0, shadowOpacity: 0, elevation: 0 }
    }
    if (from === index) {
      return {
        transform: [{ translateY: drag.dy.get() }],
        zIndex: 1,
        shadowOpacity: 0.18,
        elevation: 6,
      }
    }
    const room = makeRoom(drag.heights.get(), index, from, drag.to.get())
    return {
      transform: [{ translateY: withTiming(room, { duration: 150 }) }],
      zIndex: 0,
      shadowOpacity: 0,
      elevation: 0,
    }
  })

  const actions = [
    ...(index > 0 ? [{ name: 'moveUp', label: t('languages.moveUp', { language: name }) }] : []),
    ...(index < count - 1
      ? [{ name: 'moveDown', label: t('languages.moveDown', { language: name }) }]
      : []),
  ]
  const onAction = (event: AccessibilityActionEvent): void => {
    onMove(entry.code, event.nativeEvent.actionName === 'moveUp' ? index - 1 : index + 1)
  }

  // One language has nowhere to go, so it gets no handle to suggest otherwise.
  const handle =
    count > 1 ? (
      <GestureDetector gesture={pan}>
        <View
          accessible
          accessibilityLabel={t('languages.reorder', { language: name })}
          accessibilityActions={actions}
          onAccessibilityAction={onAction}
          style={[styles.handle, look?.handle]}
        >
          <Feather name="menu" size={18} color={look?.handleColor ?? colors.textFaint} />
        </View>
      </GestureDetector>
    ) : null

  return (
    <Animated.View
      onLayout={(event) => {
        const height = event.nativeEvent.layout.height
        /*
         * `modify`, on the UI thread, and not a copy made here. A write
         * with `.set()` from JS lands on the UI thread later, so every row laid
         * out in the same pass read the same empty array and the last write
         * won: one height out of three. Heights of 0 meant the neighbours
         * never made room and the dropped row flew back to where it started.
         */
        drag.heights.modify((heights) => {
          'worklet'
          heights[index] = height
          return heights
        })
      }}
      style={[styles.draggable, look?.ground ? { backgroundColor: look.ground } : null, moving]}
    >
      {renderRow(entry, handle)}
    </Animated.View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  // Opaque, so the row lifted over its neighbours does not show them through it.
  draggable: {
    backgroundColor: colors.bg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
  // Bigger than the glyph: gesture-handler hit-tests the view itself, so a
  // `hitSlop` here would not reach the drag.
  handle: { alignItems: 'center', height: 36, justifyContent: 'center', width: 28 },
}))
