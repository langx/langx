import Feather from '@expo/vector-icons/Feather'
import { STREAK_REMINDER_LOCAL_HOUR } from '@langx/shared'
import * as Device from 'expo-device'
import { useEffect, useState } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import { registerPushToken, requestPushPermission } from '../hooks/usePushRegistration'
import { makeStyles, useTheme } from '../lib/theme'
import { useT } from '../i18n'
import { Button } from './ui/Button'

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
export function NotificationPriming({
  look,
}: {
  /**
   * The redesign's panel (`flags.v3Home`): Echo's tint, and the two answers
   * as pills — Enable in the blue, since it is the main action that does not
   * commit, so the screen's one yellow stays on its own button.
   */
  look?: 'v3'
} = {}) {
  const styles = useStyles()
  const redesign = useV3Styles()
  const { v3 } = useTheme()
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
      const result = await requestPushPermission('priming')
      if (result.status === Notifications.PermissionStatus.GRANTED) await registerPushToken()
    } catch {
      // A declined or broken permission is a normal outcome, not an error.
    } finally {
      setBusy(false)
      setVisible(false)
    }
  }

  const body = t('notifications.primingBody', { hour: STREAK_REMINDER_LOCAL_HOUR })

  if (look === 'v3') {
    return (
      <View style={redesign.panel}>
        <View style={redesign.head}>
          <View style={redesign.mark}>
            <Feather name="bell" size={v3.icon.lg} color={v3.colors.echoText} />
          </View>
          <View style={redesign.text}>
            <Text style={redesign.title}>{t('notifications.primingTitle')}</Text>
            <Text style={redesign.body}>{body}</Text>
          </View>
        </View>
        <View style={redesign.actions}>
          <Button
            variant="blue"
            size="small"
            label={t('common.enable')}
            loading={busy}
            onPress={enable}
            style={redesign.action}
          />
          <Button
            variant="secondary"
            size="small"
            label={t('notifications.notNow')}
            onPress={() => setVisible(false)}
            style={redesign.action}
          />
        </View>
      </View>
    )
  }

  return (
    <View style={styles.panel}>
      <View style={styles.text}>
        <Text style={styles.title}>{t('notifications.primingTitle')}</Text>
        <Text style={styles.body}>{body}</Text>
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

const useV3Styles = makeStyles(({ v3 }) => ({
  panel: {
    backgroundColor: v3.colors.echoTint,
    borderRadius: v3.radius.badge,
    gap: v3.space[12],
    padding: v3.space[14],
  },
  head: { flexDirection: 'row', gap: v3.space[12] },
  mark: {
    alignItems: 'center',
    backgroundColor: v3.colors.bg,
    borderRadius: v3.radius.icon,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  text: { flex: 1, gap: v3.space[4] },
  title: { ...v3.type.headline, color: v3.colors.echoText },
  body: { ...v3.type.caption, color: v3.colors.fg },
  // Under the words rather than under the bell, as drawn.
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[8], paddingStart: 56 },
  action: { width: 'auto' },
}))
