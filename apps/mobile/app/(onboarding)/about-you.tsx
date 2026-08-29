import { GENDERS, MINIMUM_AGE } from '@langx/shared'
import { router } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
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

  const year = Number(draft.birthYear)
  const thisYear = new Date().getFullYear()
  const yearLooksValid = /^\d{4}$/.test(draft.birthYear) && year > 1900 && year <= thisYear
  const oldEnough = yearLooksValid && thisYear - year >= MINIMUM_AGE

  const canContinue = draft.displayName.trim().length > 0 && oldEnough

  // The age gate is enforced server-side at profile creation (see age.ts) —
  // this only saves the user a round-trip and an error they cannot fix by
  // retrying. It is not the check that matters.
  const ageError =
    draft.birthYear.length === 4 && yearLooksValid && !oldEnough
      ? t('onboarding.tooYoung', { age: MINIMUM_AGE })
      : undefined

  return (
    <Screen scroll>
      <Text style={styles.step}>2 / 4</Text>
      <Text style={styles.title}>{t('onboarding.aboutYouTitle')}</Text>

      <FormField
        label={t('onboarding.displayName')}
        value={draft.displayName}
        onChangeText={(displayName) => updateDraft({ displayName })}
        placeholder={t('onboarding.namePlaceholder')}
        autoCapitalize="words"
      />

      <FormField
        label={t('onboarding.yearOfBirth')}
        value={draft.birthYear}
        onChangeText={(birthYear) =>
          updateDraft({ birthYear: birthYear.replace(/\D/g, '').slice(0, 4) })
        }
        placeholder={t('onboarding.yearPlaceholder')}
        keyboardType="number-pad"
        {...(ageError ? { error: ageError } : {})}
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
