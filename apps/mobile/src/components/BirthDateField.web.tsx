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
export function BirthDateField({ label, value, onChange, error, look, hint }: BirthDateFieldProps) {
  const today = useStyles()
  const redesign = useV3Styles()
  const v3 = look === 'v3'
  const styles = v3 ? redesign : today
  const theme = useTheme()
  const faint = v3 ? theme.v3.colors.muted : theme.colors.textFaint
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
          placeholderTextColor={faint}
          keyboardType="number-pad"
          maxLength={2}
          accessibilityLabel={t('onboarding.day')}
        />
        <TextInput
          style={[styles.input, styles.small, error ? styles.inputError : null]}
          value={month}
          onChangeText={(text) => update({ month: text })}
          placeholder={t('onboarding.month')}
          placeholderTextColor={faint}
          keyboardType="number-pad"
          maxLength={2}
          accessibilityLabel={t('onboarding.month')}
        />
        <TextInput
          style={[styles.input, styles.year, error ? styles.inputError : null]}
          value={year}
          onChangeText={(text) => update({ year: text })}
          placeholder={String(EARLIEST_BIRTH_YEAR + 95)}
          placeholderTextColor={faint}
          keyboardType="number-pad"
          maxLength={4}
          accessibilityLabel={t('onboarding.year')}
        />
      </View>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : v3 && hint ? (
        <Text style={redesign.hint}>{hint}</Text>
      ) : null}
    </View>
  )
}

const useStyles = makeStyles(({ colors, radius, spacing }) => ({
  container: { gap: spacing.sm, width: '100%' },
  label: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  row: { flexDirection: 'row', gap: spacing.sm },
  // FormField's pill, so the boxes read as part of the same form: the `fill`
  // grey is the box and the border only appears to say "error".
  input: {
    backgroundColor: colors.fill,
    borderColor: 'transparent',
    borderRadius: radius.pill,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    height: 54,
    paddingHorizontal: spacing.lg,
    textAlign: 'center',
  },
  small: { width: 78 },
  year: { width: 104 },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: 14, paddingHorizontal: 20 },
}))

/** The redesign's boxes: `BirthDateField`'s grey pill, three times. */
const useV3Styles = makeStyles(({ v3 }) => ({
  container: { gap: v3.space[6], width: '100%' },
  label: { ...v3.type.buttonSmall, color: v3.colors.fg, paddingHorizontal: v3.space[4] },
  row: { flexDirection: 'row', gap: v3.space[8] },
  input: {
    ...v3.type.body,
    backgroundColor: v3.colors.surface,
    borderColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    borderWidth: 3,
    color: v3.colors.fg,
    fontWeight: '600',
    height: 58,
    paddingHorizontal: v3.space[16],
    textAlign: 'center',
  },
  small: { width: 84 },
  year: { width: 112 },
  inputError: { borderColor: v3.colors.danger },
  error: { ...v3.type.caption, color: v3.colors.danger, paddingHorizontal: v3.space[4] },
  hint: { ...v3.type.caption, color: v3.colors.muted, paddingHorizontal: v3.space[4] },
}))
