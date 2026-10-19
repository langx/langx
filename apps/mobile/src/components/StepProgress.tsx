import Feather from '@expo/vector-icons/Feather'
import { Pressable, Text, View } from 'react-native'
import { ONBOARDING_STEPS } from '../lib/onboardingStep'
import { makeStyles, useTheme } from '../lib/theme'
import { useT } from '../i18n'

/**
 * The wizard header: "Step 1 of 5" over one bar per step, the steps up to
 * this one filled in ink — v3's drawing of it. Both the count and the bars
 * come from `ONBOARDING_STEPS`, so merging two steps into one — as the
 * language questions just were — cannot leave a screen claiming a total the
 * wizard no longer has.
 *
 * Drawn here rather than with `ui/ProgressBar`, which moves on Reanimated:
 * every onboarding step renders this, and the launch path stays on React
 * Native's `Animated` (_The row swipe runs on the UI thread_). Nothing here
 * needs to move anyway — each step is a new screen, so its bars are simply
 * there.
 */
export function StepProgress({
  step,
  steps = ONBOARDING_STEPS,
  onBack,
}: {
  step: (typeof ONBOARDING_STEPS)[number]
  /**
   * The sequence this screen belongs to. A guest walks a shorter one — two
   * questions, not five — and passing it here rather than hard-coding a total
   * keeps the same guarantee the comment above describes: the count and the
   * fill come from one list, so neither can claim a total the wizard does not
   * have.
   */
  steps?: readonly (typeof ONBOARDING_STEPS)[number][] | undefined
  /**
   * Draws the back arrow beside the block. Every step after the first passes
   * it; the first has nothing behind it but the gate.
   */
  onBack?: () => void
}) {
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()
  const index = steps.indexOf(step)
  const total = steps.length
  const stepText = t('onboarding.stepOf', { step: index + 1, total })

  return (
    <View style={styles.row}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.backPlain')}
          hitSlop={12}
          onPress={onBack}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
      ) : null}
      <View style={styles.block}>
        <Text style={styles.step}>{stepText}</Text>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={stepText}
          accessibilityValue={{ min: 1, max: total, now: index + 1 }}
          style={styles.bars}
        >
          {steps.map((each, at) => (
            <View key={each} style={[styles.bar, at <= index && styles.barDone]} />
          ))}
        </View>
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  row: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  // 34 square, as `ScreenHeader` draws it: the arrow's own hit box before
  // `hitSlop` widens it.
  back: { alignItems: 'center', height: 34, justifyContent: 'center', width: 34 },
  pressed: { opacity: 0.5 },
  block: { flex: 1, gap: v3.space[6] },
  step: { ...v3.type.label, color: v3.colors.muted },
  bars: { flexDirection: 'row', gap: v3.space[4] },
  // The steps ahead in `track`, as the drawing has them.
  bar: { backgroundColor: v3.colors.track, borderRadius: v3.radius.pill, flex: 1, height: 8 },
  barDone: { backgroundColor: v3.colors.fg },
}))
