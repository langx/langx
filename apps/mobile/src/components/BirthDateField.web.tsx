import { EARLIEST_BIRTH_YEAR, isCalendarDate } from '@langx/shared'
import { Text, TextInput, View } from 'react-native'
import { makeStyles, useTheme } from '../lib/theme'
import type { BirthDateFieldProps } from './BirthDateField'
import { useT } from '../i18n'

/**
 * The web's answer, because `@react-native-community/datetimepicker` has no web
 * implementation at all — Metro picks this file over the native one.
 *
 * Three boxes rather than one masked field: a mask has to choose between
 * `DD/MM` and `MM/DD` and will be wrong for half the people reading it, while
 * three labelled boxes are unambiguous in every locale. They are also what a
 * keyboard is good at, which is the input this variant actually runs on.
 */
export function BirthDateField({ label, value, onChange, error }: BirthDateFieldProps) {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()

  const [year = '', month = '', day = ''] = value ? value.split('-') : []

  // Rebuilt from the three boxes on every keystroke, and only reported once it
  // is a real day — a half-typed `1995-06-1` is not a date and must not be
  // sent as one.
  function update(next: { year?: string; month?: string; day?: string }): void {
    const y = (next.year ?? year).replace(/\D/g, '').slice(0, 4)
    const m = (next.month ?? month).replace(/\D/g, '').slice(0, 2)
    const d = (next.day ?? day).replace(/\D/g, '').slice(0, 2)
    if (y.length === 4 && m.length > 0 && d.length > 0) {
      const candidate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
      onChange(isCalendarDate(candidate) ? candidate : `${y}-${m}-${d}`)
      return
    }
    onChange(`${y}-${m}-${d}`)
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.small, error ? styles.inputError : null]}
          value={day}
          onChangeText={(text) => update({ day: text })}
          placeholder={t('onboarding.day')}
          placeholderTextColor={colors.textFaint}
          keyboardType="number-pad"
          maxLength={2}
          accessibilityLabel={t('onboarding.day')}
        />
        <TextInput
          style={[styles.input, styles.small, error ? styles.inputError : null]}
          value={month}
          onChangeText={(text) => update({ month: text })}
          placeholder={t('onboarding.month')}
          placeholderTextColor={colors.textFaint}
          keyboardType="number-pad"
          maxLength={2}
          accessibilityLabel={t('onboarding.month')}
        />
        <TextInput
          style={[styles.input, styles.year, error ? styles.inputError : null]}
          value={year}
          onChangeText={(text) => update({ year: text })}
          placeholder={String(EARLIEST_BIRTH_YEAR + 95)}
          placeholderTextColor={colors.textFaint}
          keyboardType="number-pad"
          maxLength={4}
          accessibilityLabel={t('onboarding.year')}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  container: { gap: 6, width: '100%' },
  label: { ...font.label, color: colors.textMuted },
  row: { flexDirection: 'row', gap: spacing.sm },
  // Filled like FormField's inputs; the border only exists to say "error".
  input: {
    backgroundColor: colors.fill,
    borderColor: colors.fill,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    textAlign: 'center',
  },
  small: { width: 78 },
  year: { width: 104 },
  inputError: { borderColor: colors.danger },
  error: { ...font.caption, color: colors.danger },
}))
