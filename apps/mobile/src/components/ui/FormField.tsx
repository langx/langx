import { Text, TextInput, type TextInputProps, View } from 'react-native'
import { makeStyles, useTheme } from '../../lib/theme'

interface FormFieldProps extends TextInputProps {
  label: string
  error?: string | undefined
  /**
   * Shows a live `used / max` counter beside the label. The limits live in
   * `packages/shared/src/profile.ts` and were enforced only by the server, so
   * a long bio was rejected after being written rather than while.
   */
  maxLength?: number
}

export function FormField({ label, error, maxLength, style, ...inputProps }: FormFieldProps) {
  const { colors } = useTheme()
  const styles = useStyles()
  const used = typeof inputProps.value === 'string' ? inputProps.value.length : 0
  // Quiet until it matters. A counter on an empty field is noise; one at 90%
  // is a warning.
  const showCount = maxLength !== undefined && used > maxLength * 0.6

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {showCount ? (
          <Text style={[styles.count, used > maxLength ? styles.countOver : null]}>
            {used} / {maxLength}
          </Text>
        ) : null}
      </View>
      <TextInput
        style={[
          styles.input,
          // Controls are pills, but a pill with three lines in it is a lozenge
          // with the text jammed against its curve. Multiline gets the card
          // radius instead.
          inputProps.multiline ? styles.inputMultiline : styles.inputSingle,
          error ? styles.inputError : null,
          style,
        ]}
        placeholderTextColor={colors.textFaint}
        autoCapitalize="none"
        autoCorrect={false}
        {...(maxLength !== undefined ? { maxLength } : {})}
        {...inputProps}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  container: { gap: 6, width: '100%' },
  labelRow: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
  label: { ...font.label, color: colors.textMuted },
  count: { ...font.caption, color: colors.textFaint },
  countOver: { color: colors.danger },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  inputSingle: { borderRadius: radius.pill },
  inputMultiline: { borderRadius: radius.lg },
  inputError: { borderColor: colors.danger },
  error: { ...font.caption, color: colors.danger },
}))
