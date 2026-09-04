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
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

export default function AboutYouStep() {
  useScreenInteractive()
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
      <Text style={styles.subtitle}>{t('onboarding.aboutYouBody')}</Text>

      <View style={styles.form}>
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

        <View>
          <Text style={styles.label}>{t('onboarding.gender')}</Text>
          <View style={styles.genders}>
            {GENDERS.map((gender) => {
              const on = draft.gender === gender
              return (
                <Pressable
                  key={gender}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => updateDraft({ gender })}
                  style={({ pressed }) => [
                    styles.gender,
                    on && styles.genderActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.genderText, on && styles.genderTextActive]}>
                    {genderLabel(t, gender)}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          {/*
            Required by `architecture.md`: choosing this has a consequence people
            cannot see, and finding out later that you were invisible to half the
            searches on the app is a bad way to learn it.
          */}
          {draft.gender === 'undisclosed' ? (
            <Text style={styles.genderNote}>{t('onboarding.undisclosedNote')}</Text>
          ) : null}
        </View>

        <FormField
          label={t('onboarding.aboutYouOptional')}
          value={draft.bio}
          onChangeText={(bio) => updateDraft({ bio })}
          placeholder={t('onboarding.aboutYouPlaceholder')}
          multiline
        />
      </View>

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
  title: { ...font.title, color: colors.text, lineHeight: 38, marginTop: spacing.xl + 2 },
  subtitle: {
    ...font.body,
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
    marginTop: spacing.sm + 2,
  },
  form: { gap: spacing.lg + 2, marginTop: spacing.xl },
  // Matches FormField's label so the gender group reads as one more field.
  label: { color: colors.textMuted, fontSize: 14, fontWeight: '600', marginBottom: spacing.sm },
  genders: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  gender: {
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  // Ink, not yellow: yellow is reserved for the one committing action below.
  genderActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  genderText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  genderTextActive: { color: colors.bg, fontWeight: '700' },
  genderNote: { ...font.caption, color: colors.textMuted, marginTop: spacing.sm },
  pressed: { opacity: 0.7 },
  cta: { marginTop: spacing.xl },
}))
