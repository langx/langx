import Feather from '@expo/vector-icons/Feather'
import { useEffect, useState } from 'react'
import { Modal, Platform, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { dismissValue, resolveAlert, subscribeToAlerts, type AlertRequest } from '../lib/alert'
import { makeStyles, useTheme } from '../lib/theme'
import { Button } from './ui/Button'

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
 *
 * On a phone it is v3's bottom sheet: a handle, the question in the display
 * face, the choices as hairline rows, and Cancel as the one outlined button
 * under them — the same sheet the message menu falls back to, so a dialog and
 * a menu are one shape. On the web it stays a centred card, for the reason
 * `MessageMenuHost` gives: a sheet rising from the bottom of a desktop window
 * is a long way from the pointer.
 */
export function AlertHost() {
  const styles = useStyles()
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()

  const [request, setRequest] = useState<AlertRequest<unknown> | null>(null)

  useEffect(() => subscribeToAlerts(setRequest), [])

  if (!request) return null
  const dismiss = (): void => resolveAlert(request.id, dismissValue(request.buttons))
  const wide = Platform.OS === 'web'

  /*
   * The cancel button — or the only button, when there is nothing to choose
   * between — is drawn as the outlined button at the foot of the sheet; every
   * other button is a row. So "OK" on a plain message is the foot, and a
   * three-way report picker is three rows over Cancel.
   */
  const foot =
    request.buttons.find((button) => button.style === 'cancel') ??
    (request.buttons.length === 1 ? request.buttons[0] : undefined)
  const rows = request.buttons.filter((button) => button !== foot)

  return (
    <Modal transparent animationType={wide ? 'fade' : 'slide'} visible onRequestClose={dismiss}>
      {/* Tapping outside is the same as cancelling, and the same as the back button. */}
      <Pressable
        style={[styles.backdrop, wide ? styles.backdropCentred : styles.backdropBottom]}
        onPress={dismiss}
      >
        {/* Swallows the press so tapping the dialog itself does not close it. */}
        <Pressable
          style={[
            wide ? styles.card : styles.sheet,
            wide ? null : { paddingBottom: insets.bottom + 24 },
          ]}
          onPress={() => {}}
        >
          {wide ? null : <View style={styles.handle} />}
          <Text style={styles.title}>{request.title}</Text>
          {request.message ? <Text style={styles.message}>{request.message}</Text> : null}
          {rows.map((button, index) => (
            <Pressable
              key={button.label}
              accessibilityRole="button"
              onPress={() => resolveAlert(request.id, button.value)}
              style={({ pressed }) => [
                styles.row,
                // The last row's rule would double the button's border under it.
                index < rows.length - 1 && styles.rowDivided,
                pressed && styles.rowPressed,
              ]}
            >
              {/*
                A glyph turns the same row into a menu item — see `AlertButton`.
                Muted whatever the label says, the way the message menu's sheet
                draws its icons.
              */}
              {button.icon ? (
                <Feather name={button.icon as never} size={20} color={colors.textMuted} />
              ) : null}
              <Text style={[styles.rowLabel, button.style === 'destructive' && styles.destructive]}>
                {button.label}
              </Text>
              {button.locked ? <Feather name="lock" size={16} color={colors.textFaint} /> : null}
            </Pressable>
          ))}
          {foot ? (
            <Button
              variant="neutral"
              label={foot.label}
              onPress={() => resolveAlert(request.id, foot.value)}
              style={styles.foot}
            />
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius, cardShadow }) => ({
  backdrop: { backgroundColor: colors.scrim, flex: 1 },
  backdropBottom: { justifyContent: 'flex-end' },
  backdropCentred: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: spacing.xl,
    paddingTop: 10,
    // A sheet floats over the page, so it keeps the one shadow the flat design
    // allows; deeper than a card's because it has a whole screen behind it.
    ...cardShadow,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.14,
    shadowRadius: 38,
  },
  // A true floating surface, so it keeps elevation where the cards lost
  // theirs: shadow instead of an outline, at the sheet radius.
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    maxWidth: 420,
    padding: spacing.xl,
    width: '100%',
    ...cardShadow,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    height: 4,
    marginBottom: 18,
    width: 38,
  },
  title: { ...font.heading, color: colors.text, fontSize: 20, marginBottom: 6 },
  message: { ...font.body, color: colors.textMuted, lineHeight: 22, marginBottom: spacing.sm },
  // A column of rows, not a row of buttons: these labels are sentences
  // ("Inappropriate content"), and three of them side by side wrap into
  // unreadable stacks on a phone.
  // A flex row whether or not it carries a glyph, so a plain question and a
  // menu keep the same rhythm — and so a lock can sit at the far end.
  row: { alignItems: 'center', flexDirection: 'row', gap: 14, paddingVertical: 17 },
  rowDivided: { borderBottomColor: colors.border, borderBottomWidth: 1 },
  rowPressed: { opacity: 0.6 },
  rowLabel: { color: colors.text, flex: 1, fontSize: 17, fontWeight: '600' },
  destructive: { color: colors.danger },
  foot: { marginTop: 18 },
}))
