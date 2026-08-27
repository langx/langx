import { GENDERS, MINIMUM_AGE, type Gender } from '@langx/shared'
import { router } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Button } from '../../src/components/ui/Button'
import { FormField } from '../../src/components/ui/FormField'
import { Screen } from '../../src/components/ui/Screen'
import { updateDraft, useOnboardingDraft } from '../../src/hooks/useOnboardingDraft'
import { colors, font, radius, spacing } from '../../src/lib/theme'

const GENDER_LABELS: Record<Gender, string> = {
  female: 'Female',
  male: 'Male',
  other: 'Other',
  undisclosed: 'Prefer not to say',
}

export default function AboutYouStep() {
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
      ? `LangX is for people aged ${MINIMUM_AGE} and over.`
      : undefined

  return (
    <Screen scroll>
      <Text style={styles.step}>2 / 4</Text>
      <Text style={styles.title}>About you</Text>

      <FormField
        label="Display name"
        value={draft.displayName}
        onChangeText={(displayName) => updateDraft({ displayName })}
        placeholder="Alex"
        autoCapitalize="words"
      />

      <FormField
        label="Year of birth"
        value={draft.birthYear}
        onChangeText={(birthYear) =>
          updateDraft({ birthYear: birthYear.replace(/\D/g, '').slice(0, 4) })
        }
        placeholder="1996"
        keyboardType="number-pad"
        {...(ageError ? { error: ageError } : {})}
      />

      <Text style={styles.label}>Gender</Text>
      <View style={styles.genders}>
        {GENDERS.map((gender) => (
          <Pressable
            key={gender}
            onPress={() => updateDraft({ gender })}
            style={[styles.gender, draft.gender === gender && styles.genderActive]}
          >
            <Text style={[styles.genderText, draft.gender === gender && styles.genderTextActive]}>
              {GENDER_LABELS[gender]}
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
        <Text style={styles.genderNote}>
          Choosing this keeps you out of gender-filtered searches.
        </Text>
      ) : null}

      <FormField
        label="About you (optional)"
        value={draft.bio}
        onChangeText={(bio) => updateDraft({ bio })}
        placeholder="What do you like talking about?"
        multiline
      />

      <Button
        label="Continue"
        disabled={!canContinue}
        onPress={() => router.push('/(onboarding)/photo')}
        style={styles.cta}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
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
})
