import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native'

interface ButtonProps {
  label: string
  onPress: () => void | Promise<void>
  loading?: boolean
  disabled?: boolean
  variant?: 'primary' | 'secondary'
  style?: ViewStyle
}

export function Button({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <Pressable
      onPress={() => void onPress()}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' ? styles.primary : styles.secondary,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : '#111'} />
      ) : (
        <Text style={variant === 'primary' ? styles.primaryText : styles.secondaryText}>
          {label}
        </Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 20,
    width: '100%',
  },
  primary: { backgroundColor: '#111' },
  secondary: { backgroundColor: 'transparent', borderColor: '#111', borderWidth: 1 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryText: { color: '#111', fontSize: 16, fontWeight: '600' },
})
