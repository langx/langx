import { GENDERS, MINIMUM_AGE, birthDateSchema } from '@langx/shared'
import { router } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
import { BirthDateField } from '../../src/components/BirthDateField'
import { StepProgress } from '../../src/components/StepProgress'
import { Button } from '../../src/components/ui/Button'
import { FormField } from '../../src/components/ui/FormField'
import { Screen } from '../../src/components/ui/Screen'
import { updateDraft, useOnboardingDraft } from '../../src/hooks/useOnboardingDraft'
import { makeStyles } from '../../src/lib/theme'
import { genderLabel, useT } from '../../src/i18n'

export default function AboutYouStep() {
  const styles = useStyles()
  const t = useT()

  const draft = useOnboardingDraft()

  /**
   * The same schema the server will run, so the two cannot drift: a date that
   * passes here is one `POST /profiles` accepts. This only saves the user a
   * round trip and an error they cannot act on — the gate is still the server.
   */
  const valid = birthDateSchema().safeParse(draft.birthDate).success
  const canContinue = draft.displayName.trim().length > 0 && valid

  // Quiet until the date is complete: an age warning under a half-typed year
  // is an accusation nobody has earned yet.
  const ageError =
    draft.birthDate.length === 10 && !valid
      ? t('onboarding.tooYoung', { age: MINIMUM_AGE })
      : undefined

  return (
    <Screen scroll>
      <StepProgress step="about-you" />
      <Text style={styles.title}>{t('onboarding.aboutYouTitle')}</Text>

      <FormField
        label={t('onboarding.displayName')}
        value={draft.displayName}
        onChangeText={(displayName) => updateDraft({ displayName })}
        placeholder={t('onboarding.namePlaceholder')}
        autoCapitalize="words"
      />

      <BirthDateField
        label={t('onboarding.birthDate')}
        value={draft.birthDate}
        onChange={(birthDate) => updateDraft({ birthDate })}
        error={ageError}
      />

      <Text style={styles.label}>{t('onboarding.gender')}</Text>
      <View style={styles.genders}>
        {GENDERS.map((gender) => (
          <Pressable
            key={gender}
            onPress={() => updateDraft({ gender })}
            style={[styles.gender, draft.gender === gender && styles.genderActive]}
          >
            <Text style={[styles.genderText, draft.gender === gender && styles.genderTextActive]}>
              {genderLabel(t, gender)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/*
        Required by `architecture.md`: choosing this has a consequence people
        cannot see, and finding out later that you were invisible to half the
        searches on the app is a bad way to learn it.
      */}
      {draft.gender === 'undisclosed' ? (
        <Text style={styles.genderNote}>{t('onboarding.undisclosedNote')}</Text>
      ) : null}

      <FormField
        label={t('onboarding.aboutYouOptional')}
        value={draft.bio}
        onChangeText={(bio) => updateDraft({ bio })}
        placeholder={t('onboarding.aboutYouPlaceholder')}
        multiline
      />

      <Button
        label={t('common.continue')}
        disabled={!canContinue}
        onPress={() => router.push('/(onboarding)/photo')}
        style={styles.cta}
      />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  step: { ...font.caption, color: colors.textMuted, marginTop: spacing.lg },
  title: { ...font.title, color: colors.text, marginBottom: spacing.lg, marginTop: spacing.xs },
  label: { ...font.label, color: colors.text, marginBottom: spacing.sm, marginTop: spacing.md },
  genders: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  gender: {
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  genderActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  genderText: { ...font.caption, color: colors.textMuted },
  genderTextActive: { color: colors.primaryText, fontWeight: '700' },
  genderNote: { ...font.caption, color: colors.textMuted, marginTop: spacing.sm },
  cta: { marginTop: spacing.xl },
}))
