import Feather from '@expo/vector-icons/Feather'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { EARLIEST_BIRTH_YEAR } from '@langx/shared'
import { useState } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import { makeStyles, useTheme } from '../lib/theme'
import { formatDayKey, parseDayKey } from '../lib/birthDate'
import { useT } from '../i18n'

export interface BirthDateFieldProps {
  label: string
  /** `YYYY-MM-DD`, or empty while nothing has been chosen. */
  value: string
  onChange: (next: string) => void
  error?: string | undefined
  /**
   * The redesign's field (`flags.v3Home`): the same picker behind a grey pill
   * with a calendar glyph, and a line under it that is there before anything
   * is wrong.
   */
  look?: 'v3' | undefined
  /** That line, in the redesign's look only. `error` takes its place. */
  hint?: string | undefined
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
export function BirthDateField({ label, value, onChange, error, look, hint }: BirthDateFieldProps) {
  const today = useStyles()
  const redesign = useV3Styles()
  const v3 = look === 'v3'
  const styles = v3 ? redesign : today
  const { v3: tokens } = useTheme()
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
        {v3 ? <Feather name="calendar" size={tokens.icon.lg} color={tokens.colors.fg} /> : null}
        <Text style={value ? styles.value : styles.placeholder}>
          {value ? formatShown(value) : t('onboarding.birthDatePlaceholder')}
        </Text>
        {v3 ? (
          <Feather name="chevron-down" size={tokens.icon.lg} color={tokens.colors.muted} />
        ) : null}
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

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : v3 && hint ? (
        <Text style={redesign.hint}>{hint}</Text>
      ) : null}
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
  container: { gap: spacing.sm, width: '100%' },
  label: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  // FormField's pill, so the two fields above and below it read as one form:
  // the `fill` grey is the box and the border only appears to say "error".
  input: {
    backgroundColor: colors.fill,
    borderColor: 'transparent',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 54,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  inputError: { borderColor: colors.danger },
  value: { color: colors.text, fontSize: 16 },
  placeholder: { color: colors.textFaint, fontSize: 16 },
  picker: { alignItems: 'center' },
  done: { paddingVertical: spacing.sm },
  doneText: { ...font.label, color: colors.accent },
  error: { color: colors.danger, fontSize: 14, paddingHorizontal: 20 },
}))

const useV3Styles = makeStyles(({ v3 }) => ({
  container: { gap: v3.space[6], width: '100%' },
  label: { ...v3.type.buttonSmall, color: v3.colors.fg, paddingHorizontal: v3.space[4] },
  // The redesign's field: the grey pill, its edge drawn in its own colour at
  // rest so that gaining a red one moves nothing.
  input: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    borderWidth: 3,
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 58,
    paddingEnd: v3.space[16],
    paddingStart: v3.space[20],
  },
  inputError: { borderColor: v3.colors.danger },
  value: { ...v3.type.body, color: v3.colors.fg, flex: 1, fontWeight: '600' },
  placeholder: { ...v3.type.body, color: v3.colors.muted, flex: 1 },
  picker: { alignItems: 'center' },
  done: { minHeight: 44, justifyContent: 'center' },
  doneText: { ...v3.type.button, color: v3.colors.echoText },
  error: { ...v3.type.caption, color: v3.colors.danger, paddingHorizontal: v3.space[4] },
  hint: { ...v3.type.caption, color: v3.colors.muted, paddingHorizontal: v3.space[4] },
}))
