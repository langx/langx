import { Text, View } from 'react-native'
import { ONBOARDING_STEPS } from '../lib/onboardingStep'
import { makeStyles } from '../lib/theme'

/**
 * One bar per screen of the wizard, filled up to where you are.
 *
 * The count says where you are; the bars say how much is left, which is the
 * question somebody halfway through an onboarding is actually asking. Both
 * come from `ONBOARDING_STEPS`, so splitting a step into two — as the language
 * questions just were — cannot leave a screen claiming "2 / 4" on a wizard
 * that now has six.
 */
export function StepProgress({ step }: { step: (typeof ONBOARDING_STEPS)[number] }) {
  const styles = useStyles()
  const index = ONBOARDING_STEPS.indexOf(step)
  const total = ONBOARDING_STEPS.length

  return (
    <View style={styles.progress}>
      {ONBOARDING_STEPS.map((name, position) => (
        <View key={name} style={[styles.bar, position <= index && styles.barOn]} />
      ))}
      <Text style={styles.step}>
        {index + 1}/{total}
      </Text>
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  progress: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  bar: { backgroundColor: colors.border, borderRadius: radius.pill, flex: 1, height: 6 },
  barOn: { backgroundColor: colors.primary },
  step: { ...font.caption, color: colors.textMuted, fontWeight: '600' },
}))
