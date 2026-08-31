import { Text, View } from 'react-native'
import { ONBOARDING_STEPS } from '../lib/onboardingStep'
import { makeStyles } from '../lib/theme'
import { useT } from '../i18n'

/**
 * v3's wizard header: "Step 1 of 4" over one continuous 4px track, filled in
 * `accent` up to where you are. Both the count and the fill come from
 * `ONBOARDING_STEPS`, so merging two steps into one — as the language
 * questions just were — cannot leave a screen claiming a total the wizard no
 * longer has.
 */
export function StepProgress({
  step,
  steps = ONBOARDING_STEPS,
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
}) {
  const styles = useStyles()
  const t = useT()
  const index = steps.indexOf(step)
  const total = steps.length

  return (
    <View style={styles.root}>
      <Text style={styles.step}>{t('onboarding.stepOf', { step: index + 1, total })}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${((index + 1) / total) * 100}%` }]} />
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors, spacing, radius }) => ({
  root: { gap: spacing.sm, marginTop: spacing.lg },
  step: { color: colors.textFaint, fontSize: 13, fontWeight: '600' },
  track: { backgroundColor: colors.fill, borderRadius: radius.pill, height: 4 },
  fill: { backgroundColor: colors.accent, borderRadius: radius.pill, height: 4 },
}))
