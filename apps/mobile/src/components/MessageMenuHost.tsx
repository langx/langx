import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { Modal, Platform, Pressable, StyleSheet, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  resolveMessageMenu,
  subscribeToMessageMenu,
  type MessageMenuRequest,
} from '../lib/messageMenu'
import { colors, font, radius, spacing } from '../lib/theme'

/**
 * Draws whatever `src/lib/messageMenu.ts` has open.
 *
 * `Modal`, mounted at the root above the navigator, for `AlertHost`'s reason:
 * react-native-web renders a Modal into its own layer, while an absolutely
 * positioned overlay inside the tab navigator sits *under* the tab bar — which
 * is exactly where a bottom sheet's actions would be.
 *
 * A sheet on a phone and a centred card in a browser, because a sheet pinned
 * to the bottom of a desktop window is a long way from the message it belongs
 * to.
 */
export function MessageMenuHost() {
  const [request, setRequest] = useState<MessageMenuRequest | null>(null)
  const insets = useSafeAreaInsets()

  useEffect(() => subscribeToMessageMenu(setRequest), [])

  if (!request) return null
  const dismiss = (): void => resolveMessageMenu(request.id, null)
  const wide = Platform.OS === 'web'

  return (
    <Modal transparent animationType="fade" visible onRequestClose={dismiss}>
      <Pressable
        style={[styles.backdrop, wide ? styles.backdropCentred : styles.backdropBottom]}
        onPress={dismiss}
      >
        {/* Swallows the press so tapping the sheet itself does not close it. */}
        <Pressable
          style={[
            styles.sheet,
            wide ? styles.sheetCard : { paddingBottom: insets.bottom + spacing.md },
          ]}
          onPress={() => {}}
        >
          <Text style={styles.preview} numberOfLines={2}>
            {request.preview}
          </Text>
          {request.actions.map((action) => (
            <Pressable
              key={action.id}
              accessibilityRole="button"
              onPress={() => resolveMessageMenu(request.id, action.id)}
              style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
            >
              <Ionicons
                // The icon set types its own names; the action table is plain
                // data and does not import them.
                name={action.icon as never}
                size={20}
                color={action.destructive ? colors.danger : colors.text}
              />
              <Text style={[styles.label, action.destructive && styles.destructive]}>
                {action.label}
              </Text>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  action: {
    alignItems: 'center',
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  actionPressed: { backgroundColor: colors.surface },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.35)', flex: 1 },
  backdropBottom: { justifyContent: 'flex-end' },
  backdropCentred: { alignItems: 'center', justifyContent: 'center' },
  destructive: { color: colors.danger },
  label: { ...font.body, color: colors.text },
  preview: {
    ...font.caption,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.md,
  },
  sheetCard: {
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    maxWidth: 360,
    paddingBottom: spacing.md,
    width: '100%',
  },
})
