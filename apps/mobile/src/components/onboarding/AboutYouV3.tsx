import Feather from '@expo/vector-icons/Feather'
import type { Gender } from '@langx/shared'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useLocale, useT } from '../../i18n'
import { makeStyles, useTheme } from '../../lib/theme'
import { BirthDateField } from '../BirthDateField'
import { Button } from '../ui/Button'
import { Screen } from '../ui/Screen'
import { FieldV3, WizardHeaderV3, WizardTitle, useWizardStyles } from './WizardV3'

/**
 * Step 3 in the redesign's look. The rules are the route's and unchanged: the
 * same schema decides the birth date, and the minimum age is stated before
 * anyone types, as a plain line under the field, turning into the error only
 * once a whole date is too young. Gender is four pills in two rows rather
 * than one segmented control, so "Not saying" has room for its words.
 */
export function AboutYouV3({
  onBack,
  displayName,
  onDisplayName,
  nameFromAccount,
  birthDate,
  onBirthDate,
  ageHint,
  ageError,
  gender,
  genderOptions,
  onGender,
  genderNote,
  canContinue,
  onContinue,
}: {
  onBack: () => void
  displayName: string
  onDisplayName: (name: string) => void
  /** The field still holds the account's own name, offered rather than asked for. */
  nameFromAccount: boolean
  birthDate: string
  onBirthDate: (date: string) => void
  ageHint: string
  ageError: string | undefined
  gender: Gender
  genderOptions: readonly { value: Gender; label: string }[]
  onGender: (gender: Gender) => void
  genderNote: string
  canContinue: boolean
  onContinue: () => void
}) {
  const t = useT()
  const styles = useStyles()
  const wizard = useWizardStyles()
  const { v3 } = useTheme()
  const { isRtl } = useLocale()

  return (
    <Screen fluid ground={v3.colors.bg}>
      {/* Its own scroll view, as today's step: the fields are low on the screen. */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={wizard.column}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <WizardHeaderV3 step="about-you" onBack={onBack} />
        <WizardTitle title={t('onboarding.aboutYouTitle')} body={t('onboarding.aboutYouBody')} />

        <View style={styles.form}>
          <FieldV3
            label={t('onboarding.displayName')}
            value={displayName}
            onChangeText={onDisplayName}
            placeholder={t('onboarding.namePlaceholder')}
            autoCapitalize="words"
            hint={nameFromAccount ? t('onboarding.nameFromSignUp') : undefined}
          />

          <BirthDateField
            look="v3"
            label={t('onboarding.birthDate')}
            value={birthDate}
            onChange={onBirthDate}
            error={ageError}
            hint={ageHint}
          />

          <View style={styles.field}>
            <Text style={styles.label}>{t('onboarding.gender')}</Text>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel={t('onboarding.gender')}
              style={styles.genders}
            >
              {genderOptions.map((option) => {
                const on = option.value === gender
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    onPress={() => onGender(option.value)}
                    style={({ pressed }) => [
                      styles.gender,
                      on && styles.genderOn,
                      pressed && styles.pressed,
                    ]}
                  >
                    {on ? (
                      <Feather name="check" size={v3.icon.sm} color={v3.colors.pillText} />
                    ) : null}
                    <Text style={[styles.genderText, on && styles.genderTextOn]}>
                      {option.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
            {/* Always shown, for the reason the route gives. */}
            <Text style={wizard.hint}>{genderNote}</Text>
          </View>
        </View>

        <View style={wizard.footer}>
          <Button
            label={t('common.continue')}
            icon={isRtl ? 'arrow-left' : 'arrow-right'}
            iconPosition="end"
            disabled={!canContinue}
            onPress={onContinue}
          />
        </View>
      </ScrollView>
    </Screen>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  scroll: { flex: 1 },
  form: { gap: v3.space[20], marginTop: v3.space[8] },
  field: { gap: v3.space[6] },
  label: { ...v3.type.buttonSmall, color: v3.colors.fg, paddingHorizontal: v3.space[4] },
  genders: { flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[8] },
  // Two to a row: the basis is just under half, and the gap takes the rest.
  gender: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    flexBasis: '45%',
    flexDirection: 'row',
    flexGrow: 1,
    gap: v3.space[8],
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: v3.space[12],
  },
  genderOn: { backgroundColor: v3.colors.pill },
  genderText: { ...v3.type.button, color: v3.colors.fg, flexShrink: 1, textAlign: 'center' },
  genderTextOn: { color: v3.colors.pillText },
  pressed: { opacity: 0.7 },
}))
