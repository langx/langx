import { router } from 'expo-router'
import { Text, View } from 'react-native'
import { LanguagePicker } from '../../src/components/LanguagePicker'
import { StepProgress } from '../../src/components/StepProgress'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { updateDraft, useOnboardingDraft } from '../../src/hooks/useOnboardingDraft'
import { makeStyles } from '../../src/lib/theme'
import { useT } from '../../src/i18n'

/** Step 2 of 6: the languages you want to practise. */
export default function LearningStep() {
  const styles = useStyles()
  const t = useT()

  const draft = useOnboardingDraft()
  const codes = draft.learning.map((entry) => entry.code)

  function toggle(code: string): void {
    // The level is asked for on the next screen, so a language arrives here
    // without one. `null` rather than a default: see `OnboardingDraft`.
    const next = codes.includes(code)
      ? draft.learning.filter((entry) => entry.code !== code)
      : [...draft.learning, { code, level: null }]
    updateDraft({ learning: next })
  }

  return (
    <Screen fluid style={styles.screen}>
      <StepProgress step="learning" />
      <Text style={styles.title}>{t('onboarding.learningTitle')}</Text>
      <Text style={styles.subtitle}>{t('onboarding.learningBody')}</Text>

      <LanguagePicker
        selected={codes}
        onToggle={toggle}
        disabledCodes={draft.nativeLanguages}
        max={5}
      />

      <View style={styles.hints}>
        <Text style={styles.hint}>{t('onboarding.upToFive')}</Text>
        <Text style={styles.hint}>{t('onboarding.cannotBeBoth')}</Text>
      </View>

      <Button
        label={t('common.continue')}
        disabled={draft.learning.length === 0}
        onPress={() => router.push('/(onboarding)/levels')}
        style={styles.cta}
      />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  screen: { paddingBottom: spacing.lg },
  title: { ...font.title, color: colors.text, fontSize: 27, marginTop: spacing.xl },
  subtitle: {
    ...font.body,
    color: colors.textMuted,
    marginBottom: spacing.lg,
    marginTop: spacing.xs,
  },
  hints: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  hint: { ...font.caption, color: colors.textFaint },
  cta: { marginTop: spacing.md },
}))
