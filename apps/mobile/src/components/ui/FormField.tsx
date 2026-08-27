import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native'

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
        style={[styles.input, error ? styles.inputError : null, style]}
        placeholderTextColor="#999"
        autoCapitalize="none"
        autoCorrect={false}
        {...(maxLength !== undefined ? { maxLength } : {})}
        {...inputProps}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: 6, width: '100%' },
  labelRow: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 13, fontWeight: '600', opacity: 0.7 },
  count: { fontSize: 12, opacity: 0.5 },
  countOver: { color: '#c0392b', opacity: 1 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#999',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  inputError: { borderColor: '#c0392b' },
  error: { color: '#c0392b', fontSize: 12 },
})
