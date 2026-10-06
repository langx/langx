import { Vibration } from 'react-native'

/**
 * The ring on a phone, while the app is open: a vibration, and no sound.
 *
 * A ringtone file would have to be chosen, licensed and bundled, and on a
 * phone the ring that matters is the system's own call screen — CallKit and
 * Android's call notification, with the person's own ringtone — which arrives
 * with the second half of the native work. Until then a call that comes in
 * while the app is in front buzzes like one, and the screen says who it is.
 * The caller hears nothing while it rings; the screen says "Ringing…".
 * `ringtone.web.ts` is the one that makes a sound.
 */
const PATTERN = [0, 900, 1100]

export function startRinging(kind: 'incoming' | 'outgoing', _label?: string): void {
  stopRinging()
  if (kind === 'incoming') Vibration.vibrate(PATTERN, true)
}

export function stopRinging(): void {
  Vibration.cancel()
}
