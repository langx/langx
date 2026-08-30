import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { EARLIEST_BIRTH_YEAR } from '@langx/shared'
import { useState } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import { makeStyles } from '../lib/theme'
import { formatDayKey, parseDayKey } from '../lib/birthDate'
import { useT } from '../i18n'

export interface BirthDateFieldProps {
  label: string
  /** `YYYY-MM-DD`, or empty while nothing has been chosen. */
  value: string
  onChange: (next: string) => void
  error?: string | undefined
}

/**
 * The platform's own date picker, because a birth date is the one field where
 * everybody already knows the control: a wheel on iOS, the calendar dialog on
 * Android. Three text boxes would be faster to build and slower to use, and
 * would invent a date format on a screen full of people whose format is not
 * the same as ours.
 *
 * The web has no equivalent here — the package ships no web implementation —
 * so `BirthDateField.web.tsx` sits beside this file and Metro picks it there.
 */
export function BirthDateField({ label, value, onChange, error }: BirthDateFieldProps) {
  const styles = useStyles()
  const t = useT()
  const [open, setOpen] = useState(false)

  const chosen = parseDayKey(value)
  // A picker has to open on something. Eighteen years ago is both the youngest
  // allowed and the shortest scroll for the people who are closest to it.
  const initial = chosen ?? new Date(new Date().getFullYear() - 18, 0, 1)

  function onPicked(event: DateTimePickerEvent, date?: Date): void {
    // Android's dialog closes itself; iOS's inline spinner does not, and
    // dismissing it must not count as choosing today.
    if (Platform.OS !== 'ios') setOpen(false)
    if (event.type === 'dismissed' || !date) return
    onChange(formatDayKey(date))
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => setOpen(true)}
        style={[styles.input, error ? styles.inputError : null]}
      >
        <Text style={value ? styles.value : styles.placeholder}>
          {value ? formatShown(value) : t('onboarding.birthDatePlaceholder')}
        </Text>
      </Pressable>

      {open ? (
        <View style={styles.picker}>
          <DateTimePicker
            value={initial}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={new Date()}
            minimumDate={new Date(EARLIEST_BIRTH_YEAR, 0, 1)}
            onChange={onPicked}
          />
          {Platform.OS === 'ios' ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setOpen(false)}
              style={styles.done}
            >
              <Text style={styles.doneText}>{t('common.done')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

/**
 * Shown as the reader's own locale writes it. `toLocaleDateString` on a date
 * built at local noon — midnight would land on the previous day for anyone
 * west of UTC, which is exactly the bug the `YYYY-MM-DD` storage avoids.
 */
function formatShown(value: string): string {
  const date = parseDayKey(value)
  return date ? date.toLocaleDateString(undefined, { dateStyle: 'long' }) : value
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  container: { gap: 6, width: '100%' },
  label: { ...font.label, color: colors.textMuted },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  inputError: { borderColor: colors.danger },
  value: { color: colors.text, fontSize: 16 },
  placeholder: { color: colors.textFaint, fontSize: 16 },
  picker: { alignItems: 'center' },
  done: { paddingVertical: spacing.sm },
  doneText: { ...font.label, color: colors.accent },
  error: { ...font.caption, color: colors.danger },
}))
