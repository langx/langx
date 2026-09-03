import { useEffect } from 'react'
import { Platform } from 'react-native'
import { api } from '../api/client'
import { currentLocale } from '../i18n/runtime'
import { messagingModule, type MessagingModule } from '../lib/pushMessaging'

/**
 * Registers this device's FCM token with the API.
 *
 * Assumes permission is already granted; the caller checks. Safe to call more
 * than once — `/me/devices` upserts on the token.
 */
export async function registerPushToken(): Promise<void> {
  try {
    const fm = await messagingModule()
    if (!fm) return
    const messaging = fm.getMessaging()
    // iOS hands out a token only once the app is registered for remote
    // messages; Android does this on its own. Idempotent on both.
    if (Platform.OS === 'ios') await fm.registerDeviceForRemoteMessages(messaging)
    const token = await fm.getToken(messaging)
    if (!token) return
    await api.post('/me/devices', {
      // The device's language, not the account's: a streak reminder arrives
      // when the app is closed, so nothing else can decide what it says.
      locale: currentLocale(),
      pushToken: token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    })
  } catch {
    // Never let notification setup break the app it is decorating.
  }
}

/**
 * Removes this device's push token from the account it is currently signed
 * into. Call before ending the session.
 *
 * Without it a signed-out device keeps receiving that account's message and
 * streak notifications until the token happens to be reassigned — someone
 * signs out on a borrowed or sold phone and their messages keep arriving on
 * it. `DELETE /me/devices/:token` existed for this from the beginning and
 * nothing called it.
 *
 * Every failure is swallowed. A token that cannot be removed must never be
 * able to trap someone in a signed-in state: being unable to sign out is a
 * worse outcome than a stale token, and the server drops the token anyway the
 * moment it is claimed by another account.
 */
export async function unregisterPushToken(): Promise<void> {
  try {
    const fm = await messagingModule()
    if (!fm) return
    const messaging = fm.getMessaging()
    const status = await fm.hasPermission(messaging)
    // No permission means no token was ever registered from this device.
    if (!granted(fm, status)) return
    const token = await fm.getToken(messaging)
    if (token) await api.delete(`/me/devices/${encodeURIComponent(token)}`)
  } catch {
    // See above: never block a sign-out.
  }
}

/**
 * Registers the push token on launch — and **does not ask for permission**.
 *
 * It used to ask, the moment the signed-in layout mounted: a system dialog
 * before the app had shown anything, about a product the user had not used
 * yet. That is the highest-refusal pattern there is, and on iOS the refusal is
 * permanent — the OS never asks again, so a "no" collected in the first two
 * seconds costs every future message notification.
 *
 * Asking now belongs to `NotificationPriming`, on a screen the user arrived at
 * deliberately and which says what the notifications are for. This hook only
 * registers the token for someone who has *already* granted permission, so
 * everyone who said yes before is entirely unaffected.
 */
export function usePushRegistration({ enabled = true }: { enabled?: boolean } = {}): void {
  useEffect(() => {
    if (!enabled) return
    void (async () => {
      try {
        const fm = await messagingModule()
        if (!fm) return
        const status = await fm.hasPermission(fm.getMessaging())
        if (!granted(fm, status)) return
        await registerPushToken()
      } catch {
        // Never let notification setup break the app it is decorating.
      }
    })()
  }, [enabled])
}

/**
 * Provisional counts. On iOS it is the quiet "deliver to the notification
 * centre, no banner" grant, and a token registered under it still gets every
 * message — the person just has to open the shade to see them.
 */
export function granted(fm: MessagingModule, status: number): boolean {
  return (
    status === fm.AuthorizationStatus.AUTHORIZED || status === fm.AuthorizationStatus.PROVISIONAL
  )
}
