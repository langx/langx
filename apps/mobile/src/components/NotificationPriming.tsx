import { STREAK_REMINDER_LOCAL_HOUR } from '@langx/shared'
import * as Device from 'expo-device'
import { useEffect, useState } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import { registerPushToken } from '../hooks/usePushRegistration'
import { makeStyles } from '../lib/theme'
import { useT } from '../i18n'

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
  const styles = useStyles()
  const t = useT()

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
    <View style={styles.panel}>
      <View style={styles.text}>
        <Text style={styles.title}>{t('notifications.primingTitle')}</Text>
        <Text style={styles.body}>
          {t('notifications.primingBody', { hour: STREAK_REMINDER_LOCAL_HOUR })}
        </Text>
      </View>
      {/*
        Text actions, not Buttons: the screens that mount this panel have a
        committing yellow of their own, and a second pair of pills under it
        would compete. Enable is the panel's own accent voice; Not now is the
        quiet exit.
      */}
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          hitSlop={8}
          onPress={() => void enable()}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text style={styles.enable}>{t('common.enable')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => setVisible(false)}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text style={styles.dismiss}>{t('notifications.notNow')}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  panel: {
    alignItems: 'center',
    backgroundColor: colors.accentBg,
    borderRadius: radius.lg,
    flexDirection: 'row',
    gap: spacing.md + 2,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg + 2,
    paddingVertical: 15,
  },
  text: { flex: 1, gap: 2 },
  title: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  body: { ...font.caption, color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  actions: { alignItems: 'flex-end', gap: spacing.sm },
  enable: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  dismiss: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.6 },
}))
