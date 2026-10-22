import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useT } from '../../i18n'
import { makeStyles, useTheme } from '../../lib/theme'
import { PRESS_SCALE_CARD, TIMING, unlessReduced } from '../../lib/theme/motion'
import { IconButton } from '../ui/IconButton'
import { PressableScale } from '../ui/PressableScale'

export interface PinnedStripContent {
  messageId: string
  /** "Pinned · Maria", already worded. */
  label: string
  /** One line of the message, already worded. */
  line: string
}

interface PinnedStripV3Props {
  /** Null when nothing is pinned: the strip folds away. */
  pin: PinnedStripContent | null
  /** The partner's hue, as a colour; undefined until they are known. */
  hue: string | undefined
  onJump: (messageId: string) => void
  onUnpin: () => void
}

/**
 * The v3 thread's pinned message, under the partner's band: a surface card
 * with the pin in a tile of the band's own hue, who wrote the message and
 * one line of it, and an ✕.
 *
 * In the layout, never over it: the thread's list starts under the card, so
 * no bubble is drawn beneath it. Its height is measured and the card opens
 * and folds by it, so the list moves with the card rather than jumping when
 * a pin arrives or goes. The words stay on screen while the card folds —
 * they are the last pin's, kept for the length of the fold.
 *
 * One pin, because the server keeps one (`MAX_PINNED_PER_CONVERSATION`): a
 * new pin replaces the last, so there is no list here to step through.
 *
 * The ✕ unpins for real, exactly as the old strip's did and as the menu's
 * Unpin does: a pin is the conversation's, so it goes for both people, and
 * its hint says so.
 *
 * Reduced motion: the card is simply there, or gone.
 */
export function PinnedStripV3({ pin, hue, onJump, onUnpin }: PinnedStripV3Props) {
  const t = useT()
  const styles = useStyles()
  const { v3 } = useTheme()
  const reduce = useReduceMotion()
  // What is drawn: the current pin, or the last one while the card folds.
  const [drawn, setDrawn] = useState<PinnedStripContent | null>(pin)
  const height = useSharedValue(0)
  const open = useSharedValue(0)
  const showing = pin !== null

  useEffect(() => {
    if (pin) setDrawn(pin)
  }, [pin])

  useEffect(() => {
    if (showing) {
      open.set(unlessReduced(reduce, 1, (to) => withTiming(to, TIMING.enter)))
      return
    }
    if (reduce) {
      open.set(0)
      setDrawn(null)
      return
    }
    open.set(
      withTiming(0, TIMING.exit, (finished) => {
        'worklet'
        if (finished) runOnJS(setDrawn)(null)
      }),
    )
  }, [showing, reduce, open])

  const fold = useAnimatedStyle(() => ({
    height: height.get() * open.get(),
    opacity: open.get(),
  }))

  if (!drawn) return null

  const ink = hue ? v3.colors.ink : v3.colors.fg

  return (
    <Animated.View style={[styles.fold, fold]}>
      {/* Absolute, so it keeps its own height while the fold above it is shorter. */}
      <View
        style={styles.measure}
        onLayout={(event) => height.set(event.nativeEvent.layout.height)}
      >
        <View style={styles.card}>
          <PressableScale
            accessibilityRole="button"
            accessibilityHint={t('chat.goToPinned')}
            scaleTo={PRESS_SCALE_CARD}
            onPress={() => onJump(drawn.messageId)}
            touchStyle={styles.touch}
            style={styles.main}
          >
            <View style={[styles.tile, { backgroundColor: hue ?? v3.colors.track }]}>
              <Ionicons name="pin" size={v3.icon.sm} color={ink} />
            </View>
            <View style={styles.words}>
              <Text style={styles.label} numberOfLines={1}>
                {drawn.label}
              </Text>
              <Text style={styles.line} numberOfLines={1}>
                {drawn.line}
              </Text>
            </View>
          </PressableScale>
          <IconButton
            icon="x"
            iconSize={v3.icon.md}
            color={v3.colors.muted}
            accessibilityLabel={t('messageActions.unpin')}
            accessibilityHint={t('chat.unpinHint')}
            onPress={onUnpin}
          />
        </View>
      </View>
    </Animated.View>
  )
}

/** The tile: a step under a row's 40pt leading square, so the card stays one line tall. */
const TILE = 36

const useStyles = makeStyles(({ v3 }) => ({
  fold: { overflow: 'hidden' },
  measure: {
    left: 0,
    paddingBottom: v3.space[4],
    paddingHorizontal: v3.space[16],
    paddingTop: v3.space[8],
    position: 'absolute',
    right: 0,
    top: 0,
  },
  card: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.row,
    flexDirection: 'row',
    paddingEnd: v3.space[4],
  },
  // The touch target takes the row the ✕ leaves; without it the face inside
  // sizes to its text and pushes the ✕ off the card.
  touch: { flex: 1, minWidth: 0 },
  main: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[10],
    minWidth: 0,
    paddingStart: v3.space[10],
    paddingVertical: v3.space[10],
  },
  tile: {
    alignItems: 'center',
    borderRadius: v3.radius.icon,
    height: TILE,
    justifyContent: 'center',
    width: TILE,
  },
  words: { flex: 1, gap: v3.space[2], minWidth: 0 },
  label: { ...v3.type.label, color: v3.colors.muted },
  line: { ...v3.type.callout, color: v3.colors.fg },
}))
