import { GENDERS, MINIMUM_AGE, birthDateSchema, type Gender } from '@langx/shared'
import { router } from 'expo-router'
import { useEffect, useRef } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { BirthDateField } from '../../src/components/BirthDateField'
import { StepProgress } from '../../src/components/StepProgress'
import { Button } from '../../src/components/ui/Button'
import { FormField } from '../../src/components/ui/FormField'
import { Screen } from '../../src/components/ui/Screen'
import { SegmentedControl } from '../../src/components/ui/SegmentedControl'
import {
  isDraftHydrated,
  updateDraft,
  useOnboardingDraft,
} from '../../src/hooks/useOnboardingDraft'
import { authClient } from '../../src/lib/auth-client'
import { goBackTo } from '../../src/lib/navigation'
import { displayNameToSeed } from '../../src/lib/seedDisplayName'
import { makeStyles } from '../../src/lib/theme'
import { genderLabel, useT } from '../../src/i18n'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

export default function AboutYouStep() {
  useScreenInteractive()
  const styles = useStyles()
  const t = useT()

  const draft = useOnboardingDraft()
  const accountName = authClient.useSession().data?.user.name?.trim() ?? ''
  const seeded = useRef(false)

  /**
   * The name the account already has, filled in rather than asked for twice.
   *
   * Sign-up takes a name, and Google and Apple hand one over without being
   * asked — so by the time anyone reaches this screen the answer is on file.
   * It is seeded rather than removed because an Apple account often carries a
   * full legal name and this is the field other people see: worth offering,
   * not worth forcing.
   *
   * **After hydration, never before.** `hydrateDraft` merges stored values
   * under anything this session has touched, so a name written here first
   * would count as touched and beat the one the person typed on an earlier
   * launch. The ref then stops it running again, which is what lets someone
   * clear the field and have it stay clear.
   */
  useEffect(() => {
    const seed = displayNameToSeed({
      current: draft.displayName,
      accountName,
      hydrated: isDraftHydrated(),
      alreadySeeded: seeded.current,
    })
    if (seed === null) return
    seeded.current = true
    updateDraft({ displayName: seed })
  }, [accountName, draft])

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

  /*
   * The segment has room for four short words, and "Prefer not to say" is not
   * one — so the undisclosed option gets its own short label here, and the
   * note under the control names it the same way.
   */
  const notSaying = t('onboarding.genderNotSaying')
  const genderOptions = GENDERS.map((gender) => ({
    value: gender,
    label: gender === 'undisclosed' ? notSaying : genderLabel(t, gender),
  }))

  return (
    <Screen fluid>
      {/*
        Own scroll view rather than `Screen scroll`, for the same reason
        `Screen` inset the keyboard: the fields are low on the screen. Here the
        content also grows to the height, which is what keeps Continue at the
        bottom while the form is shorter than the screen.
      */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <StepProgress step="about-you" onBack={() => goBackTo('/(onboarding)/levels')} />
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

          <View style={styles.field}>
            <Text style={styles.label}>{t('onboarding.gender')}</Text>
            <SegmentedControl<Gender>
              accessibilityLabel={t('onboarding.gender')}
              options={genderOptions}
              selected={[draft.gender]}
              onToggle={(gender) => updateDraft({ gender })}
            />
            {/*
              Required by `architecture.md`: choosing this has a consequence
              people cannot see, and finding out later that you were invisible
              to half the searches on the app is a bad way to learn it. Always
              shown, because the choice is also the one that cannot be undone.
            */}
            <Text style={styles.genderNote}>
              {t('onboarding.genderNote', { option: notSaying })}
            </Text>
          </View>
        </View>

        <Button
          label={t('common.continue')}
          disabled={!canContinue}
          onPress={() => router.push('/(onboarding)/handle')}
        />
      </ScrollView>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  scroll: { flex: 1 },
  // v3's wizard column: 8 above the progress block, 18 between blocks, 28
  // under the button so it is not sitting on the home indicator.
  content: { flexGrow: 1, gap: 18, paddingBottom: 28, paddingTop: spacing.sm },
  title: { ...font.title, color: colors.text, lineHeight: 38, marginTop: 10 },
  subtitle: { color: colors.textMuted, fontSize: 16, lineHeight: 24 },
  form: { flex: 1, gap: 18, marginTop: 6 },
  field: { gap: spacing.sm },
  // Matches FormField's label so the gender group reads as one more field.
  label: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  genderNote: { color: colors.textFaint, fontSize: 13, paddingHorizontal: spacing.xs },
}))
