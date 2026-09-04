import Feather from '@expo/vector-icons/Feather'
import { Pressable, Text, View, type TextStyle, type ViewStyle } from 'react-native'
import { LABEL_MARKER, splitLabel } from '../lib/splitLabel'

/**
 * Only the four rules this component draws with, not a screen's whole sheet.
 * Both composers own their own stylesheet — they sit in different layouts —
 * and naming the overlap here is what stops the label drifting between them.
 */
export interface ComposerLabelStyles {
  label: TextStyle
  labelLine: ViewStyle
  languageButton: ViewStyle
  languageText: TextStyle
  chevron: TextStyle
  pressed: ViewStyle
}

export { LABEL_MARKER }

/**
 * The field's label, with the language in it as the control that changes it.
 *
 * When there is only one language to post in the marker never arrives and this
 * is a plain line of text — the same one it always was. `splitLabel` returning
 * `null` lands in the same branch, which is what a translation that dropped the
 * placeholder should degrade to.
 */
export function ComposerLabel({
  text,
  language,
  onPress,
  anchorRef,
  styles,
}: {
  text: string
  language: string
  onPress: () => void
  anchorRef: React.RefObject<View | null>
  styles: ComposerLabelStyles
}) {
  const parts = splitLabel(text)
  if (!parts) return <Text style={styles.label}>{text}</Text>

  return (
    <View style={styles.labelLine}>
      {parts.before ? <Text style={styles.label}>{parts.before}</Text> : null}
      <Pressable
        ref={anchorRef}
        accessibilityRole="button"
        accessibilityState={{ expanded: false }}
        hitSlop={8}
        onPress={onPress}
        style={({ pressed }) => [styles.languageButton, pressed && styles.pressed]}
      >
        <Text style={styles.languageText}>{language}</Text>
        <Feather name="chevron-down" size={14} style={styles.chevron} />
      </Pressable>
      {parts.after ? <Text style={styles.label}>{parts.after}</Text> : null}
    </View>
  )
}
