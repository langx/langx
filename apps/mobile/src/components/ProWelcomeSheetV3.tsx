import Feather from '@expo/vector-icons/Feather'
import { TIER_BADGES } from '@langx/shared'
import { useEffect, useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { MeProfile } from '../api/queries'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { useT } from '../i18n'
import { CELEBRATION_MS, RAIN } from '../lib/celebration'
import { notification } from '../lib/haptics'
import { PRO_WELCOME_HIGHLIGHTS, proWelcomeCopy } from '../lib/proWelcome'
import { PARTNER_HUES, makeStyles, useTheme, type PartnerHue } from '../lib/theme'
import { SPRING } from '../lib/theme/motion'
import { Button } from './ui/Button'
import { CelebrationCard } from './ui/CelebrationSheet'
import { Confetti } from './ui/Confetti'
import { IconButton } from './ui/IconButton'

type Welcome = NonNullable<MeProfile['proWelcome']>

/**
 * "You're Pro now" under `flags.v3Home`: the celebration sheet's shape
 * (`CelebrationSheet`) with the welcome's own words and what Pro opens.
 *
 * Not `CelebrationSheet` itself, for two reasons. It has nowhere for the list
 * of what Pro opens, which is the point of this screen rather than garnish;
 * and its next step closes the sheet and then runs, which here would count
 * one welcome as both closed and started. `ProWelcomeHost` decides when it
 * opens and what each way out does; this is the paint.
 *
 * No board draws it. Everything that differs from the current card follows
 * V-Celebrate: the person's own hue for the block, the title in Display, the
 * shower in the partner hues and down by `CELEBRATION_MS`, the next step in
 * blue, and a ✕ a screen reader can find. The PRO chip is the neutral
 * outline v3 draws PRO in, in ink on the hue.
 */
export function ProWelcomeSheetV3({
  welcome,
  hue,
  onStart,
  onClose,
}: {
  welcome: Welcome
  hue: PartnerHue
  onStart: () => void
  onClose: () => void
}) {
  const t = useT()
  const styles = useStyles()
  const { v3 } = useTheme()
  const insets = useSafeAreaInsets()
  const reduceMotion = useReduceMotion()
  const copy = proWelcomeCopy(welcome)
  const [raining, setRaining] = useState(true)

  const colours = useMemo(() => PARTNER_HUES.map((each) => v3.hues[each]), [v3])
  const pieces = useMemo(() => ({ kind: 'flat', colours }) as const, [colours])

  const pop = useSharedValue(0)

  // Once, on opening: the buzz is the moment, not the animation.
  useEffect(() => {
    void notification('success')
  }, [])

  // The chip lands with one bounce after the sheet has faded in. With reduced
  // motion it is simply there.
  useEffect(() => {
    pop.set(reduceMotion ? 1 : withDelay(180, withSpring(1, SPRING.bounce)))
  }, [reduceMotion, pop])

  // v3's rule: the last piece has landed by `CELEBRATION_MS`, and then the
  // shower is taken down rather than left running off screen.
  useEffect(() => {
    const timer = setTimeout(() => setRaining(false), CELEBRATION_MS)
    return () => clearTimeout(timer)
  }, [])

  // `CelebrationSheet`'s rule: any touch ends the motion at its rest, and
  // still reaches what it touched, so the tap that skips can be Start.
  const skip = (): false => {
    if (raining) {
      pop.set(1)
      setRaining(false)
    }
    return false
  }

  const chipStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.get() * 2),
    transform: [{ scale: 0.4 + 0.6 * pop.get() }],
  }))

  return (
    <Modal
      visible
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
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
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <CelebrationCard
              hue={hue}
              title={t(copy.title.key, copy.title.params)}
              body={t(copy.body.key, copy.body.params)}
              art={
                <Animated.View style={[styles.chip, chipStyle]}>
                  <Text style={styles.chipText}>{TIER_BADGES.pro}</Text>
                </Animated.View>
              }
            />
            <View style={styles.highlights}>
              {PRO_WELCOME_HIGHLIGHTS.map((highlight) => (
                <View key={highlight.key} style={styles.highlight}>
                  <View style={styles.highlightIcon}>
                    <Feather name={highlight.icon} size={v3.icon.sm} color={v3.colors.fg} />
                  </View>
                  <Text style={styles.highlightLabel}>{t(highlight.key)}</Text>
                </View>
              ))}
              <Text style={styles.more}>{t('proWelcome.andMore')}</Text>
            </View>
          </ScrollView>
          <Button variant="blue" label={t('proWelcome.start')} onPress={onStart} />
        </View>
        {raining && !reduceMotion ? (
          <Confetti pieces={pieces} count={36} rain={RAIN.celebration} />
        ) : null}
      </View>
    </Modal>
  )
}

/** The highlight's disc, and the indent "and more" takes to line up with the words. */
const DISC = 40

const useStyles = makeStyles(({ v3 }) => ({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    alignSelf: 'center',
    backgroundColor: v3.colors.bg,
    borderTopEndRadius: v3.radius.block,
    borderTopStartRadius: v3.radius.block,
    gap: v3.space[12],
    maxHeight: '92%',
    maxWidth: 560,
    paddingHorizontal: v3.space[12],
    paddingTop: v3.space[8],
    width: '100%',
  },
  content: { gap: v3.space[16] },
  chip: {
    alignSelf: 'flex-start',
    borderColor: v3.colors.ink,
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[4],
  },
  chipText: { ...v3.type.headline, color: v3.colors.ink, letterSpacing: 2 },
  highlights: { gap: v3.space[10], paddingHorizontal: v3.space[8] },
  highlight: { alignItems: 'center', flexDirection: 'row', gap: v3.space[12] },
  highlightIcon: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    height: DISC,
    justifyContent: 'center',
    width: DISC,
  },
  highlightLabel: { ...v3.type.callout, color: v3.colors.fg, flex: 1, fontWeight: '600' },
  more: { ...v3.type.caption, color: v3.colors.muted, paddingStart: DISC + v3.space[12] },
}))
