import Feather from '@expo/vector-icons/Feather'
import { Pressable, Text, View } from 'react-native'
import { ONBOARDING_STEPS } from '../lib/onboardingStep'
import { makeStyles, useTheme } from '../lib/theme'
import { useT } from '../i18n'
import { ProgressBar } from './ui/ProgressBar'

/**
 * v3's wizard header: "Step 1 of 4" over one continuous track, filled in
 * `accent` up to where you are. Both the count and the fill come from
 * `ONBOARDING_STEPS`, so merging two steps into one — as the language
 * questions just were — cannot leave a screen claiming a total the wizard no
 * longer has.
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
        <ProgressBar value={(index + 1) / total} height={6} accessibilityLabel={stepText} />
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  row: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  // 34 square, as `ScreenHeader` draws it: the arrow's own hit box before
  // `hitSlop` widens it.
  back: { alignItems: 'center', height: 34, justifyContent: 'center', width: 34 },
  pressed: { opacity: 0.5 },
  block: { flex: 1, gap: 10 },
  step: { color: colors.textFaint, fontSize: 13, fontWeight: '600' },
}))
