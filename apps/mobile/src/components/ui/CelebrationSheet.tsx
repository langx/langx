import type Feather from '@expo/vector-icons/Feather'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useT } from '../../i18n'
import { CELEBRATION_MS, RAIN, claimCelebration } from '../../lib/celebration'
import { notification } from '../../lib/haptics'
import { shareLink } from '../../lib/share'
import type { ShareContent } from '../../lib/shareText'
import { PARTNER_HUES, makeStyles, useTheme, type PartnerHue } from '../../lib/theme'
import { SPRING } from '../../lib/theme/motion'
import { Button } from './Button'
import { Confetti } from './Confetti'
import { IconButton } from './IconButton'

interface CelebrationCardProps {
  /** The block's colour: the partner's, for a pair; the person's own otherwise. */
  hue: PartnerHue
  title: string
  body: string
  /** Above the title — the pair's faces, a `PairFlameChip`. */
  art?: ReactNode
  /**
   * What it paid — "+15" — as an ink chip under the body. Inside the app
   * only: nothing that leaves it shows a token amount, which is why the
   * sheet's Share sends `share` and never this.
   */
  reward?: string
  /** Beside the reward chip: who it was for, or why — "you both wrote today". */
  rewardNote?: string
}

/**
 * The celebration's block, drawn still: ink on the hue, the title in
 * Display. The sheet moves it; a screen can also show it in place.
 */
export function CelebrationCard({
  hue,
  title,
  body,
  art,
  reward,
  rewardNote,
}: CelebrationCardProps) {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <View style={[styles.card, { backgroundColor: v3.hues[hue] }]}>
      {art}
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Text style={styles.body}>{body}</Text>
      {reward ? (
        <View style={styles.rewardRow}>
          <View style={styles.rewardChip}>
            <Text style={[styles.rewardText, { color: v3.hues[hue] }]}>{reward}</Text>
          </View>
          {rewardNote ? <Text style={styles.rewardNote}>{rewardNote}</Text> : null}
        </View>
      ) : null}
    </View>
  )
}

type Glyph = keyof typeof Feather.glyphMap

interface CelebrationSheetProps extends CelebrationCardProps {
  visible: boolean
  /**
   * The event being celebrated — `streak:2026-10-17`, `pair:<id>:9`. The
   * motion and the haptic play once per id in a run of the app
   * (`claimCelebration`); shown again, it is the card without them.
   */
  eventId: string
  /**
   * The next step, and the sheet's one blue: pressing it closes the sheet
   * and does it — back to the chat, on to the streak.
   */
  next: { label: string; onPress: () => void; icon?: Glyph }
  /**
   * What Share sends, built by `shareText.ts`, whose builders carry the
   * achievement and the invite link and never a balance. Left out, there is
   * no Share button.
   */
  share?: ShareContent
  onClose: () => void
}

/**
 * The moment a reward is acknowledged: the card, a shower of the partner
 * hues, one success haptic, the next step and Share.
 *
 * The rules it keeps, from v3's brief:
 *
 *   - **At most 1.5 s.** The card lands with one bounce and the last piece
 *     of confetti has landed by `CELEBRATION_MS`; then the rain is taken
 *     down rather than left running off screen.
 *   - **Skippable with one tap.** Any touch on the sheet ends the motion at
 *     its rest — and still does what it touched, so the tap that skips can
 *     also be the tap on the button.
 *   - **Never blocks the next action.** The button is live from the first
 *     frame; nothing waits for the animation, and the confetti never takes
 *     a touch.
 *   - **Once per event.** See `eventId`.
 *   - **Reduced motion is a static card with a success haptic** — the buzz is
 *     the moment, not the animation, so it stays.
 *
 * A `Modal`, so it needs no `OVERLAY_LAYER`: it is its own native window.
 * The ✕, a tap on the scrim and Android's back all close it.
 */
export function CelebrationSheet({
  visible,
  eventId,
  next,
  share,
  onClose,
  ...card
}: CelebrationSheetProps) {
  const t = useT()
  const styles = useStyles()
  const { v3 } = useTheme()
  const insets = useSafeAreaInsets()
  const reduce = useReduceMotion()
  const shown = useSharedValue(0)
  const [raining, setRaining] = useState(false)
  const decided = useRef<string | null>(null)

  const colours = useMemo(() => PARTNER_HUES.map((hue) => v3.hues[hue]), [v3])
  const pieces = useMemo(() => ({ kind: 'flat', colours }) as const, [colours])

  /*
   * Decided once per event, in an effect rather than during render: claiming
   * is a side effect, and the ref keeps a development double-run of the
   * effect from claiming twice and finding the event already celebrated.
   */
  useEffect(() => {
    if (!visible || decided.current === eventId) return
    decided.current = eventId
    const first = claimCelebration(eventId)
    if (first) void notification('success')
    if (first && !reduce) {
      shown.set(0)
      shown.set(withSpring(1, SPRING.bounce))
      setRaining(true)
    } else {
      shown.set(1)
    }
  }, [visible, eventId, reduce, shown])

  // `useReduceMotion` answers a moment after the first render; if the answer
  // is "less movement", whatever started stops where it would have ended.
  useEffect(() => {
    if (!reduce) return
    shown.set(1)
    setRaining(false)
  }, [reduce, shown])

  useEffect(() => {
    if (!raining) return
    const timer = setTimeout(() => setRaining(false), CELEBRATION_MS)
    return () => clearTimeout(timer)
  }, [raining])

  const skip = (): false => {
    if (raining) {
      shown.set(1)
      setRaining(false)
    }
    // Never claims the touch: it goes on to whatever was under it.
    return false
  }

  const motion = useAnimatedStyle(() => ({
    opacity: 0.4 + 0.6 * Math.min(1, shown.get()),
    transform: [{ translateY: (1 - shown.get()) * 24 }, { scale: 0.92 + 0.08 * shown.get() }],
  }))

  const goNext = (): void => {
    onClose()
    next.onPress()
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduce ? 'none' : 'fade'}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root} onStartShouldSetResponderCapture={skip}>
        {/* The scrim closes too, but the ✕ is the one a screen reader finds. */}
        <Pressable
          style={[StyleSheet.absoluteFill, v3.elevation.overlay]}
          onPress={onClose}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <View
          accessibilityViewIsModal
          style={[styles.sheet, { paddingBottom: insets.bottom + v3.space[16] }]}
        >
          <IconButton icon="x" accessibilityLabel={t('common.close')} onPress={onClose} />
          <Animated.View style={motion}>
            <CelebrationCard {...card} />
          </Animated.View>
          <View style={styles.actions}>
            <Button
              variant="blue"
              label={next.label}
              {...(next.icon ? { icon: next.icon } : {})}
              onPress={goNext}
            />
            {share ? (
              <Button
                variant="secondary"
                icon="share"
                label={t('share.action')}
                onPress={() => void shareLink(share)}
              />
            ) : null}
          </View>
        </View>
        {raining ? <Confetti pieces={pieces} count={36} rain={RAIN.celebration} /> : null}
      </View>
    </Modal>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    alignSelf: 'center',
    backgroundColor: v3.colors.bg,
    borderTopEndRadius: v3.radius.block,
    borderTopStartRadius: v3.radius.block,
    gap: v3.space[12],
    maxWidth: 560,
    paddingHorizontal: v3.space[12],
    paddingTop: v3.space[8],
    width: '100%',
  },
  card: {
    borderRadius: v3.radius.hero,
    gap: v3.space[14],
    paddingBottom: v3.space[24],
    paddingHorizontal: v3.space[20],
    paddingTop: v3.space[24],
  },
  title: { ...v3.type.display, color: v3.colors.ink },
  body: { ...v3.type.body, color: v3.colors.ink, fontWeight: '500' },
  rewardRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[10] },
  rewardChip: {
    backgroundColor: v3.colors.ink,
    borderRadius: v3.radius.pill,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: v3.space[16],
  },
  rewardText: v3.type.headline,
  rewardNote: { ...v3.type.callout, color: v3.colors.ink, flexShrink: 1, fontWeight: '600' },
  actions: { gap: v3.space[10] },
}))
