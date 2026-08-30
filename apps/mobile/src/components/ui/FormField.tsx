import Feather from '@expo/vector-icons/Feather'
import { useState } from 'react'
import { Pressable, Text, TextInput, type TextInputProps, View } from 'react-native'
import { makeStyles, useTheme } from '../../lib/theme'
import { useT } from '../../i18n'

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
  const t = useT()
  const used = typeof inputProps.value === 'string' ? inputProps.value.length : 0
  // Quiet until it matters. A counter on an empty field is noise; one at 90%
  // is a warning.
  const showCount = maxLength !== undefined && used > maxLength * 0.6

  /**
   * The eye lives here rather than at the three call sites: every password
   * field in the app is this component with `secureTextEntry`, so putting the
   * toggle in the field means none of them can be the one that forgot it.
   * Local state because it is not a preference — a revealed password hides
   * itself again the next time the screen is opened.
   */
  const [revealed, setRevealed] = useState(false)
  const secure = inputProps.secureTextEntry === true

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
      <View>
        <TextInput
          style={[
            styles.input,
            // Controls are pills, but a pill with three lines in it is a lozenge
            // with the text jammed against its curve. Multiline gets the card
            // radius instead.
            inputProps.multiline ? styles.inputMultiline : styles.inputSingle,
            error ? styles.inputError : null,
            secure ? styles.inputSecure : null,
            style,
          ]}
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          {...(maxLength !== undefined ? { maxLength } : {})}
          {...inputProps}
          secureTextEntry={secure && !revealed}
        />
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(revealed ? 'common.hidePassword' : 'common.showPassword')}
            accessibilityState={{ selected: revealed }}
            hitSlop={10}
            onPress={() => setRevealed((shown) => !shown)}
            style={styles.reveal}
          >
            <Feather name={revealed ? 'eye-off' : 'eye'} size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  container: { gap: 6, width: '100%' },
  labelRow: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  count: { ...font.caption, color: colors.textFaint },
  countOver: { color: colors.danger },
  /**
   * v3 fields are filled, not outlined: the `fill` grey is the box, and the
   * border only appears to say something — 1.5px `danger` on error.
   */
  input: {
    backgroundColor: colors.fill,
    borderColor: colors.fill,
    borderWidth: 1.5,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: spacing.lg + 2,
    paddingVertical: spacing.md + 1,
  },
  /** Room for the eye, so a long password does not run underneath it. */
  inputSecure: { paddingEnd: spacing.xxl },
  inputSingle: { borderRadius: radius.pill },
  inputMultiline: { borderRadius: radius.lg },
  inputError: { borderColor: colors.danger },
  /**
   * `end`, not `right`: in Arabic the field is right-to-left and the eye
   * belongs after the text, which is the left edge there.
   */
  reveal: {
    alignItems: 'center',
    bottom: 0,
    end: spacing.md,
    justifyContent: 'center',
    position: 'absolute',
    top: 0,
    width: 32,
  },
  error: { ...font.caption, color: colors.danger },
}))
