import Feather from '@expo/vector-icons/Feather'
import { useEffect, type ReactNode } from 'react'
import { Text } from 'react-native'
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useT } from '../../i18n'
import { makeStyles, useTheme } from '../../lib/theme'
import { TIMING, unlessReduced } from '../../lib/theme/motion'
import { PressableScale } from '../ui/PressableScale'

/**
 * "Reply ideas", above an empty composer when the other person's newest
 * message is still unanswered.
 *
 * A chip rather than ideas already waiting: every answer spends a unit of
 * the person's allowance, so nothing is asked until they tap. Drawn in the
 * `CopilotLabel`'s own blue pill, so it reads as Copilot's before it is
 * read at all.
 */
export function ReplyIdeasChip({ onPress }: { onPress: () => void }) {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  return (
    <RiseIn>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('copilot.replyIdeasA11y')}
        onPress={onPress}
        hitSlop={8}
        style={styles.chip}
      >
        <Feather name="cpu" size={14} color={colors.info} />
        <Text style={styles.text}>{t('copilot.replyIdeas')}</Text>
      </PressableScale>
    </RiseIn>
  )
}

/**
 * A block arriving above the composer: a short rise and fade on the UI
 * thread, or — with reduced motion — simply there. Started from an effect,
 * after the view exists, as every Reanimated entrance here is.
 */
export function RiseIn({ children }: { children: ReactNode }) {
  const reduce = useReduceMotion()
  const shown = useSharedValue(reduce ? 1 : 0)
  useEffect(() => {
    shown.set(unlessReduced(reduce, 1, (to) => withTiming(to, TIMING.enter)))
    return () => cancelAnimation(shown)
  }, [reduce, shown])
  const motion = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ translateY: (1 - shown.get()) * 8 }],
  }))
  return <Animated.View style={motion}>{children}</Animated.View>
}

const useStyles = makeStyles(({ colors, font, radius, spacing, v3 }) => ({
  // `CopilotLabel`'s pill, as a control.
  chip: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.infoBg,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 32,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  // `echoText`, not `info`: the blue glyph colour is under 4.5:1 as text on
  // its own tint in the light scheme, and this one is a control to read.
  text: { ...font.label, color: v3.colors.echoText },
}))
