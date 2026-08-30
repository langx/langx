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
export function StepProgress({ step }: { step: (typeof ONBOARDING_STEPS)[number] }) {
  const styles = useStyles()
  const t = useT()
  const index = ONBOARDING_STEPS.indexOf(step)
  const total = ONBOARDING_STEPS.length

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
