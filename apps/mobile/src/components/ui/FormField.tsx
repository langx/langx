import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native'

interface FormFieldProps extends TextInputProps {
  label: string
  error?: string | undefined
}

export function FormField({ label, error, style, ...inputProps }: FormFieldProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : null, style]}
        placeholderTextColor="#999"
        autoCapitalize="none"
        autoCorrect={false}
        {...inputProps}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: 6, width: '100%' },
  label: { fontSize: 13, fontWeight: '600', opacity: 0.7 },
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
