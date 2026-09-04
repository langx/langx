import { api } from '../api/client'
import { deviceId } from './deviceId'
import { FLAG_KEYS, readBoolFlag, setBoolFlag } from './localFlags'

/**
 * Notifications on **this** phone.
 *
 * Two devices signed into one account are two rows on the server, and this is
 * the switch for the row belonging to the device it is read on: turning it off
 * here must leave the other one receiving.
 *
 * Deliberately not the same thing as the per-kind switches in Settings, which
 * live on the profile and are account-wide. Those say *what* — messages, badge
 * earned, streak reminder — and this says *where*. Both have to allow.
 *
 * Stored as the refusal (`pushOffOnThisDevice`), like the analytics opt-out
 * and for the same reason: a store that cannot be read has to fall back to the
 * default, and the default is on.
 */
export async function pushEnabledOnThisDevice(): Promise<boolean> {
  return !(await readBoolFlag(FLAG_KEYS.pushOffOnThisDevice))
}

/**
 * Writes the flag and tells the server.
 *
 * The flag first, so the switch on screen is right even when the request is
 * not: the value is re-sent with every push registration, so a failed PATCH
 * costs one app start rather than leaving the two permanently disagreed.
 */
export async function setPushEnabledOnThisDevice(enabled: boolean): Promise<void> {
  await setBoolFlag(FLAG_KEYS.pushOffOnThisDevice, !enabled)
  try {
    const id = await deviceId()
    await api.patch(`/me/devices/${encodeURIComponent(id)}`, { pushEnabled: enabled })
  } catch {
    // A device that has never registered — permission was never granted, or
    // this is the web — has no row to patch, and a 404 here means nothing is
    // being sent to it anyway.
  }
}
