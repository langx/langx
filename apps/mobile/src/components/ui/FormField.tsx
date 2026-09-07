import { useState, type ReactNode } from 'react'
import { Pressable, Text, TextInput, type TextInputProps, View } from 'react-native'
import { makeStyles, useTheme } from '../../lib/theme'
import { useT } from '../../i18n'

interface FormFieldProps extends TextInputProps {
  /**
   * A node, not just a string: the feed composer draws part of its label as a
   * control — the language you are posting in, which opens a menu. Every other
   * caller still passes a plain string and gets the same `Text` as before.
   * The auth screens pass none at all and let the placeholder do the work.
   */
  label?: ReactNode
  error?: string | undefined
  /**
   * Shows a live `used / max` counter beside the label. The limits live in
   * `packages/shared/src/profile.ts` and were enforced only by the server, so
   * a long bio was rejected after being written rather than while.
   */
  maxLength?: number
}

export function FormField({
  label,
  error,
  maxLength,
  style,
  onFocus,
  onBlur,
  ...inputProps
}: FormFieldProps) {
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()
  const used = typeof inputProps.value === 'string' ? inputProps.value.length : 0
  // Quiet until it matters. A counter on an empty field is noise; one at 90%
  // is a warning.
  const showCount = maxLength !== undefined && used > maxLength * 0.6

  /**
   * The reveal lives here rather than at the three call sites: every password
   * field in the app is this component with `secureTextEntry`, so putting the
   * toggle in the field means none of them can be the one that forgot it.
   * Local state because it is not a preference — a revealed password hides
   * itself again the next time the screen is opened.
   */
  const [revealed, setRevealed] = useState(false)
  const secure = inputProps.secureTextEntry === true

  /*
   * v3's field is a grey pill at rest and a white one with a blue ring while
   * you type in it — the fill leaves and the border arrives. That needs the
   * field to know it has focus, which a stylesheet alone cannot: hence the
   * state, and the two handlers wrapped so a caller's own still run.
   */
  const [focused, setFocused] = useState(false)

  return (
    <View style={styles.container}>
      {label || showCount ? (
        <View style={styles.labelRow}>
          {typeof label === 'string' ? <Text style={styles.label}>{label}</Text> : label}
          {showCount ? (
            <Text style={[styles.count, used > maxLength ? styles.countOver : null]}>
              {used} / {maxLength}
            </Text>
          ) : null}
        </View>
      ) : null}
      <View>
        <TextInput
          style={[
            styles.input,
            // Controls are pills, but a pill with three lines in it is a lozenge
            // with the text jammed against its curve. Multiline gets a 20 radius
            // and room at the top instead.
            inputProps.multiline ? styles.inputMultiline : styles.inputSingle,
            focused ? styles.inputFocused : null,
            error ? styles.inputError : null,
            secure ? styles.inputSecure : null,
            style,
          ]}
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          {...(maxLength !== undefined ? { maxLength } : {})}
          {...inputProps}
          onFocus={(event) => {
            setFocused(true)
            onFocus?.(event)
          }}
          onBlur={(event) => {
            setFocused(false)
            onBlur?.(event)
          }}
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
            {/* A word, not an eye: v3 writes "Show" in the link blue inside the pill. */}
            <Text style={styles.revealText}>{t(revealed ? 'common.hide' : 'common.show')}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, radius }) => ({
  container: { gap: 8, width: '100%' },
  labelRow: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  count: { ...font.caption, color: colors.textFaint },
  countOver: { color: colors.danger },
  /**
   * v3 fields are filled, not outlined: the `fill` grey is the box, and the
   * border only appears to say something — `accent` while focused, `danger`
   * on error. It is always drawn, transparently, so gaining a colour does not
   * move the text by a pixel.
   */
  input: {
    backgroundColor: colors.fill,
    borderColor: 'transparent',
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 20,
  },
  inputSingle: { borderRadius: radius.pill, height: 54 },
  inputMultiline: {
    borderRadius: 20,
    lineHeight: 24,
    minHeight: 120,
    paddingVertical: 16,
    textAlignVertical: 'top',
  },
  inputFocused: { backgroundColor: colors.bg, borderColor: colors.accent },
  inputError: { borderColor: colors.danger },
  /** Room for the word, so a long password does not run underneath it. */
  inputSecure: { paddingEnd: 90 },
  /**
   * `end`, not `right`: in Arabic the field is right-to-left and the toggle
   * belongs after the text, which is the left edge there.
   */
  reveal: {
    bottom: 0,
    end: 20,
    justifyContent: 'center',
    position: 'absolute',
    top: 0,
  },
  revealText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  error: { ...font.caption, color: colors.danger, paddingHorizontal: 20 },
}))
