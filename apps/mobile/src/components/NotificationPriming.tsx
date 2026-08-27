import { STREAK_REMINDER_LOCAL_HOUR } from '@langx/shared'
import * as Device from 'expo-device'
import { useEffect, useState } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import { registerPushToken } from '../hooks/usePushRegistration'
import { Button } from './ui/Button'
import { colors, font, radius, spacing } from '../lib/theme'

/**
 * Asks for notification permission **with a reason**, on a screen the user
 * arrived at deliberately.
 *
 * The permission used to be requested the moment the signed-in layout mounted:
 * a system dialog, before the app had shown anything, about a product the user
 * had not used yet. That is the pattern with the highest refusal rate there is,
 * and the refusal is permanent — iOS never asks again, so a "no" collected in
 * the first two seconds costs every future message notification.
 *
 * Renders nothing where it cannot lead anywhere: on web, on a simulator, and
 * once permission has already been decided.
 */
export function NotificationPriming() {
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (Platform.OS === 'web' || !Device.isDevice) return
      try {
        // Lazily imported for the same reason `usePushRegistration` does it:
        // inside Expo Go on Android the module throws on import.
        const Notifications = await import('expo-notifications')
        const current = await Notifications.getPermissionsAsync()
        // `canAskAgain` false means the OS will not show a dialog however
        // nicely we ask, so offering the button would be a lie.
        if (!cancelled && !current.granted && current.canAskAgain) setVisible(true)
      } catch {
        // No notifications module, nothing to prime.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!visible) return null

  async function enable(): Promise<void> {
    setBusy(true)
    try {
      const Notifications = await import('expo-notifications')
      const result = await Notifications.requestPermissionsAsync()
      if (result.status === Notifications.PermissionStatus.GRANTED) await registerPushToken()
    } catch {
      // A declined or broken permission is a normal outcome, not an error.
    } finally {
      setBusy(false)
      setVisible(false)
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Turn on notifications?</Text>
      <Text style={styles.body}>
        Two things only: when someone messages you, and a nudge at {STREAK_REMINDER_LOCAL_HOUR}:00
        if your streak is about to break.
      </Text>
      <View style={styles.actions}>
        <Button label="Enable" onPress={() => void enable()} loading={busy} style={styles.action} />
        <Button
          label="Not now"
          variant="secondary"
          onPress={() => setVisible(false)}
          style={styles.action}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    gap: spacing.sm,
    marginTop: spacing.xl,
    padding: spacing.lg,
  },
  title: { ...font.body, color: colors.text, fontWeight: '600' },
  body: { ...font.caption, color: colors.textMuted, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  action: { flex: 1, width: 'auto' },
})
