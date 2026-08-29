import { useEffect, useState } from 'react'
import { Modal, Pressable, Text, View } from 'react-native'
import { dismissValue, resolveAlert, subscribeToAlerts, type AlertRequest } from '../lib/alert'
import { makeStyles } from '../lib/theme'

/**
 * Draws whatever `src/lib/alert.ts` has queued.
 *
 * Mounted once at the root, above the navigator, so a dialog raised from any
 * screen survives that screen navigating away — the delete-account flow signs
 * out underneath its own confirmation.
 *
 * `Modal` rather than a positioned `View` because react-native-web renders it
 * into its own layer: an absolutely positioned overlay inside the tab navigator
 * sits under the tab bar on web, which is exactly where the buttons are.
 */
export function AlertHost() {
  const styles = useStyles()

  const [request, setRequest] = useState<AlertRequest<unknown> | null>(null)

  useEffect(() => subscribeToAlerts(setRequest), [])

  if (!request) return null
  const dismiss = (): void => resolveAlert(request.id, dismissValue(request.buttons))

  return (
    <Modal transparent animationType="fade" visible onRequestClose={dismiss}>
      {/* Tapping outside is the same as cancelling, and the same as the back button. */}
      <Pressable style={styles.backdrop} onPress={dismiss}>
        {/* Swallows the press so tapping the dialog itself does not close it. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{request.title}</Text>
          {request.message ? <Text style={styles.message}>{request.message}</Text> : null}
          <View style={styles.buttons}>
            {request.buttons.map((button) => (
              <Pressable
                key={button.label}
                onPress={() => resolveAlert(request.id, button.value)}
                style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
              >
                <Text
                  style={[
                    styles.buttonText,
                    button.style === 'destructive' && styles.destructive,
                    button.style === 'cancel' && styles.cancel,
                  ]}
                >
                  {button.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  backdrop: {
    alignItems: 'center',
    backgroundColor: colors.scrim,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    maxWidth: 420,
    padding: spacing.lg,
    width: '100%',
  },
  title: { ...font.title, color: colors.text, fontSize: 20 },
  message: { ...font.body, color: colors.textMuted, lineHeight: 22, marginTop: spacing.sm },
  // A column, not a row: these labels are sentences ("Inappropriate content"),
  // and three of them side by side wrap into unreadable stacks on a phone.
  buttons: { gap: spacing.xs, marginTop: spacing.lg },
  button: { borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  buttonPressed: { backgroundColor: colors.border },
  buttonText: { ...font.body, color: colors.text, fontWeight: '600', textAlign: 'center' },
  destructive: { color: colors.danger },
  cancel: { color: colors.textMuted, fontWeight: '400' },
}))
