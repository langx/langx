import { clearFlag, FLAG_KEYS } from './localFlags'
import type { MeState } from './meState'

/**
 * Whether the device flags a stranger leaves behind for their own sign-up —
 * `pendingReferrer` and `pendingIntent` — can no longer belong to anybody.
 *
 * Both are spent by onboarding, and onboarding is the one thing a person who
 * signs in to an account they already have never sees. Open an invite link,
 * press "Open LangX", choose Google rather than "Create account", and the
 * referrer used to stay on the phone until the *next* person to register on it
 * was credited to whoever's link the first one opened: an invite nobody sent,
 * and, for the intent, a "say hello" offer to somebody they never chose.
 *
 * Only for an account with a profile. Without one the person is mid-wizard,
 * and the flags are exactly what the wizard is about to read.
 *
 * Never for a guest, although a guest has a profile too: a guest is somebody
 * who has not signed up *yet*, and the gate that stopped them wrote the intent
 * on the way to the sign-up form. A relaunch in between must not spend it.
 */
export function signupCarryOverIsStale(input: { state: MeState; isGuest: boolean }): boolean {
  return input.state === 'ready' && !input.isGuest
}

/**
 * Drops both. The intent goes too rather than being honoured: an existing
 * member who pressed "Open LangX" on a profile and then signed in can open the
 * same link again and, signed in, it now leads straight to that profile — and
 * `done.tsx`, the one place that offers the intent back, is a screen they will
 * never reach. Left in place it would greet the next sign-up on this phone with
 * somebody they never chose.
 */
export async function clearSignupCarryOver(): Promise<void> {
  await Promise.all([clearFlag(FLAG_KEYS.pendingReferrer), clearFlag(FLAG_KEYS.pendingIntent)])
}
