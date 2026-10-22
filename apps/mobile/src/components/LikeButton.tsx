import Feather from '@expo/vector-icons/Feather'
import type { LikeTargetType } from '@langx/shared'
import { useEffect, useRef, useState } from 'react'
import { Animated, Pressable, Text, View } from 'react-native'
import { useSetLike } from '../api/queries'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { useV3Home } from '../hooks/useV3Home'
import { useLocale, useT } from '../i18n'
import { compactCount } from '../lib/format'
import { impact } from '../lib/haptics'
import {
  catchUpLike,
  IDLE_LIKE,
  settleLike,
  shownCount,
  shownLiked,
  tapLike,
  type LikeIntent,
} from '../lib/likeIntent'
import { openLikers } from '../lib/navigation'
import { makeStyles, useTheme } from '../lib/theme'
import { EASE_OUT, EASE_POP } from '../lib/theme/motionAnimated'
import { DURATION } from '../lib/theme/motionValues'

/** How far the heart swells when it fills. */
const POP_SCALE = 1.25

interface LikeButtonProps {
  targetType: LikeTargetType
  targetId: string
  likeCount: number
  likedByViewer: boolean
  /** Hidden on your own content, which the server refuses to like anyway. */
  disabled?: boolean
  from: string
  /** `small` is the reply rows' size — a 15 heart with a 13 count beside it. */
  size?: 'default' | 'small'
  /**
   * Draw on a partner hue (v3's ask card) in this ink. The hues stay light
   * after dark, and no red reads on all six of them in either scheme (the
   * best, v3's light `danger`, reaches 2.16:1 on dark lilac), so here a like
   * is told by shape rather than by colour: the heart in a disc of the ink,
   * and the count in the ink throughout. Measured in `contrast.test.ts`.
   */
  ink?: string
}

/**
 * The heart and the count beside it, as two separate controls.
 *
 * They are separate on purpose: the heart says "this helped" and the count
 * opens who else thought so. Merging them into one target would make finding
 * out who liked something cost a like — which is the mistake that teaches
 * people not to tap counts.
 *
 * The count is a bare number, shown even at zero: v3 draws it as part of the
 * heart, in the heart's colour, and a heart with nothing beside it reads as
 * decoration. The word "likes" survives for screen readers, on the count's
 * label.
 *
 * Optimistic: the heart and the count move on the tap, not on the answer —
 * see `lib/likeIntent`, which also keeps a quick like-unlike to one request
 * in flight. Under v3 a like (never an unlike) pops the heart once; with
 * reduce motion on, the state changes and nothing moves.
 */
export function LikeButton({
  targetType,
  targetId,
  likeCount,
  likedByViewer,
  disabled,
  from,
  size = 'default',
  ink,
}: LikeButtonProps) {
  const styles = useStyles()
  const { colors, v3 } = useTheme()
  const t = useT()
  const { locale } = useLocale()
  const setLike = useSetLike()
  const v3Look = useV3Home()
  const reduceMotion = useReduceMotion()
  const small = size === 'small'

  /*
   * In a ref as well as in state: a request's settle runs outside any
   * render, and has to see the taps that came while it was out.
   */
  const [intentState, setIntentState] = useState<LikeIntent>(IDLE_LIKE)
  const intentRef = useRef(intentState)
  /*
   * A card can scroll out of a virtualised list, or its screen close, while a
   * request is out. The ref and any follow-up request carry on regardless —
   * a like then unlike must still end unliked on the server — and only the
   * state update is skipped once nothing is mounted to draw it.
   */
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const commit = (next: LikeIntent): void => {
    intentRef.current = next
    if (mounted.current) setIntentState(next)
  }
  // The props caught up with the tap: hand back to them, so a change made
  // elsewhere later (another screen, a refetch) shows here again.
  const caughtUp = catchUpLike(intentState, likedByViewer)
  if (caughtUp !== intentState) commit(caughtUp)
  const intent = caughtUp
  const liked = shownLiked(intent, likedByViewer)
  const count = shownCount(intent, likedByViewer, likeCount)

  /*
   * `mutateAsync` rather than `mutate`'s per-call callbacks, which React Query
   * drops once the component has unmounted — and with them the follow-up
   * request a quick like-unlike needs. The rejection is already reported by
   * `useSetLike`'s own `onError`.
   */
  const { mutateAsync } = setLike
  function send(next: boolean): void {
    mutateAsync({ targetType, targetId, liked: next }).then(
      (state) => settle(state.likedByViewer),
      () => settle(null),
    )
  }
  function settle(recorded: boolean | null): void {
    const step = settleLike(intentRef.current, recorded)
    commit(step.intent)
    if (step.send !== null) send(step.send)
  }

  // Carried from the first render, never gained on the press — see the
  // Fabric note in `ui/PressableScale`.
  const scale = useRef(new Animated.Value(1)).current
  function pop(): void {
    scale.setValue(1)
    Animated.sequence([
      Animated.timing(scale, {
        toValue: POP_SCALE,
        duration: DURATION.press,
        easing: EASE_OUT,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: DURATION.enter - DURATION.press,
        easing: EASE_POP,
        useNativeDriver: true,
      }),
    ]).start()
  }

  function onHeart(): void {
    const step = tapLike(intentRef.current, likedByViewer)
    commit(step.intent)
    if (step.send !== null) send(step.send)
    // v3 only, so the current look stays as it was. A deliberate tap whose
    // server commit has not happened yet.
    if (step.intent.desired && v3Look) {
      void impact('light')
      if (!reduceMotion) pop()
    }
  }

  // Heart and number take the same colour: red once you have liked it, muted
  // until then. On a hue, the ink for both, and the disc says liked.
  const tint = ink ?? (liked ? colors.danger : colors.textMuted)
  const filled = ink !== undefined && liked

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={liked ? t('feed.unlike') : t('feed.like')}
        accessibilityState={{ selected: liked, disabled: Boolean(disabled) }}
        disabled={disabled}
        hitSlop={8}
        onPress={onHeart}
        style={({ pressed }) => [
          styles.heart,
          filled && [styles.disc, { backgroundColor: ink }],
          pressed && styles.pressed,
        ]}
      >
        <Animated.View collapsable={false} style={{ transform: [{ scale }] }}>
          <Feather name="heart" size={small ? 15 : 18} color={filled ? v3.colors.onBlue : tint} />
        </Animated.View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('feed.likes', { count })}
        hitSlop={8}
        onPress={() => openLikers(targetType, targetId, from)}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <Text style={[small ? styles.countSmall : styles.count, { color: tint }]}>
          {compactCount(count, locale)}
        </Text>
      </Pressable>
    </View>
  )
}

const useStyles = makeStyles(() => ({
  row: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  heart: { alignItems: 'center', justifyContent: 'center', minHeight: 28, minWidth: 28 },
  disc: { borderRadius: 14 },
  count: { fontSize: 14, fontWeight: '600' },
  countSmall: { fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.6 },
}))
