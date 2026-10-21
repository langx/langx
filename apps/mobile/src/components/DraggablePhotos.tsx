import { useLayoutEffect } from 'react'
import { Image, type AccessibilityActionEvent } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { useV3Home } from '../hooks/useV3Home'
import { useT } from '../i18n'
import { LIFT_AFTER_MS } from '../lib/dragReorder'
import { nearestSlot, offsetTo, shiftedIndex, type Slot } from '../lib/gridReorder'
import { impact } from '../lib/haptics'
import { makeStyles } from '../lib/theme'

/**
 * Below this, in points, a held tile that is let go was held, not dragged.
 *
 * Holding is also how a photo is removed — it was the whole gesture before
 * the drag existed — so a lift that goes nowhere asks to remove instead.
 * A finger never rests perfectly still, hence a margin rather than zero.
 */
const HELD_NOT_DRAGGED = 8

interface Drag {
  /** The tile being dragged, or -1. */
  from: SharedValue<number>
  /** Where it would land if it were dropped now. */
  to: SharedValue<number>
  dx: SharedValue<number>
  dy: SharedValue<number>
  /** Every tile's measured position in the grid, by index. */
  slots: SharedValue<Slot[]>
}

/**
 * The gallery's stored photos, reordered by holding one and dragging it.
 *
 * Drawn as bare tiles into the caller's wrapping row, so the pending uploads
 * and the "+" that follow sit in the same grid — and stay out of the drag,
 * since neither has a place in the stored order yet.
 *
 * The same scheme as the learning list on the languages screen: tiles keep
 * their layout and only *look* moved, and the transforms come off in a layout
 * effect keyed on the order, so they clear as the new order is drawn rather
 * than a request's length before it.
 *
 * Screen readers get "move earlier / later" and "remove" as actions on each
 * photo — a drag they cannot see is not a way to reorder anything.
 */
export function DraggablePhotos({
  photos,
  size,
  onMove,
  onRemove,
}: {
  photos: { url: string }[]
  size: number
  onMove: (from: number, to: number) => void
  onRemove: (index: number) => void
}) {
  const drag: Drag = {
    from: useSharedValue(-1),
    to: useSharedValue(-1),
    dx: useSharedValue(0),
    dy: useSharedValue(0),
    slots: useSharedValue<Slot[]>([]),
  }

  function settle(): void {
    drag.from.set(-1)
    drag.to.set(-1)
    drag.dx.set(0)
    drag.dy.set(0)
  }

  const order = photos.map((photo) => photo.url).join('\n')
  // The shared values are stable, so `order` is the only thing this follows.
  useLayoutEffect(settle, [order])

  function drop(from: number, to: number): void {
    // A no-op leaves the order as it is, so nothing else would clear it.
    if (from === to) settle()
    else onMove(from, to)
  }

  function hold(index: number): void {
    settle()
    onRemove(index)
  }

  return (
    <>
      {photos.map((photo, index) => (
        <DraggablePhoto
          key={photo.url}
          url={photo.url}
          index={index}
          count={photos.length}
          size={size}
          drag={drag}
          onDrop={drop}
          onHold={hold}
          onMove={onMove}
        />
      ))}
    </>
  )
}

function DraggablePhoto({
  url,
  index,
  count,
  size,
  drag,
  onDrop,
  onHold,
  onMove,
}: {
  url: string
  index: number
  count: number
  size: number
  drag: Drag
  onDrop: (from: number, to: number) => void
  onHold: (index: number) => void
  onMove: (from: number, to: number) => void
}) {
  const current = useStyles()
  const redesigned = useStylesV3()
  const styles = useV3Home() ? redesigned : current
  const t = useT()

  const lift = (): void => void impact('light')

  const pan = Gesture.Pan()
    .activateAfterLongPress(LIFT_AFTER_MS)
    .onStart(() => {
      drag.from.set(index)
      drag.to.set(index)
      drag.dx.set(0)
      drag.dy.set(0)
      runOnJS(lift)()
    })
    .onUpdate((event) => {
      drag.dx.set(event.translationX)
      drag.dy.set(event.translationY)
      // Sliced, because a removed tile's slot is left behind at the end.
      drag.to.set(
        nearestSlot(
          drag.slots.get().slice(0, count),
          index,
          event.translationX,
          event.translationY,
        ),
      )
    })
    .onEnd((event, success) => {
      // The grid redrew under the finger — an upload landed, or a failed
      // write rolled back — and this index no longer names the tile picked up.
      if (drag.from.get() !== index) return
      if (
        success &&
        Math.abs(event.translationX) + Math.abs(event.translationY) < HELD_NOT_DRAGGED
      ) {
        runOnJS(onHold)(index)
        return
      }
      // Cancelled rather than released — the system took the touch — goes home.
      const to = success ? drag.to.get() : index
      const rest = offsetTo(drag.slots.get(), index, to)
      drag.dy.set(withTiming(rest.y, { duration: 150 }))
      drag.dx.set(
        withTiming(rest.x, { duration: 150 }, (finished) => {
          if (finished) runOnJS(onDrop)(index, to)
        }),
      )
    })

  const moving = useAnimatedStyle(() => {
    const from = drag.from.get()
    if (from === -1) {
      return { transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }], zIndex: 0 }
    }
    if (from === index) {
      return {
        transform: [{ translateX: drag.dx.get() }, { translateY: drag.dy.get() }, { scale: 1.08 }],
        zIndex: 1,
      }
    }
    const room = offsetTo(drag.slots.get(), index, shiftedIndex(index, from, drag.to.get()))
    return {
      transform: [
        { translateX: withTiming(room.x, { duration: 150 }) },
        { translateY: withTiming(room.y, { duration: 150 }) },
        { scale: 1 },
      ],
      zIndex: 0,
    }
  })

  const actions = [
    ...(index > 0 ? [{ name: 'earlier', label: t('editProfile.movePhotoEarlier') }] : []),
    ...(index < count - 1 ? [{ name: 'later', label: t('editProfile.movePhotoLater') }] : []),
    { name: 'remove', label: t('common.remove') },
  ]
  const onAction = (event: AccessibilityActionEvent): void => {
    const name = event.nativeEvent.actionName
    if (name === 'remove') onHold(index)
    else onMove(index, name === 'earlier' ? index - 1 : index + 1)
  }

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        accessible
        accessibilityRole="image"
        accessibilityLabel={t('editProfile.photoPosition', { position: index + 1, count })}
        accessibilityActions={actions}
        onAccessibilityAction={onAction}
        onLayout={(event) => {
          const { x, y } = event.nativeEvent.layout
          // `modify` on the UI thread, for the reason the languages screen
          // gives: writes with `.set()` from JS in one layout pass race, and
          // the last one wins.
          drag.slots.modify((slots) => {
            'worklet'
            slots[index] = { x, y }
            return slots
          })
        }}
        style={moving}
      >
        <Image source={{ uri: url }} style={[styles.photo, { height: size, width: size }]} />
      </Animated.View>
    </GestureDetector>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  photo: { backgroundColor: colors.fill, borderRadius: 14 },
}))

/**
 * V-EditProfile's tile: the 16pt corner the "+" beside it already has, and
 * the redesign's surface behind a picture that has not decoded yet.
 */
const useStylesV3 = makeStyles(({ v3 }) => ({
  photo: { backgroundColor: v3.colors.surface, borderRadius: 16 },
}))
