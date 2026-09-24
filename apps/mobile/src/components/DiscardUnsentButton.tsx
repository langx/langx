import Feather from '@expo/vector-icons/Feather'
import { Pressable } from 'react-native'
import { useT } from '../i18n'
import { useTheme } from '../lib/theme'

/**
 * The bin beside a message that did not go.
 *
 * The long-press menu already offered Delete, but nothing on the row said so,
 * and a row that fails every time — a thread that has been blocked, say —
 * asks for a retry forever. A send that will never succeed needs a way out
 * that can be seen.
 *
 * No confirmation, same as the menu's Delete: nothing reached the server, so
 * there is nothing to withdraw, and the words were only ever on this device.
 */
export function DiscardUnsentButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme()
  const t = useT()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('messageActions.delete')}
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 4 })}
    >
      <Feather name="trash-2" size={18} color={colors.textMuted} />
    </Pressable>
  )
}
