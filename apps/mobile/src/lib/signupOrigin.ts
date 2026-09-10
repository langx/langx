import { track } from './analytics'
import type { SignUpMethod } from './analyticsEvents'
import { clearFlag, FLAG_KEYS, readJsonFlag, writeJsonFlag } from './localFlags'

/** How this device's pending sign-up was started. */
export interface SignupOrigin {
  method: SignUpMethod
  fromGuest: boolean
}

/**
 * Counts a sign-up attempt and remembers how it was made.
 *
 * The two halves are one function because they must never disagree: the funnel
 * compares `signup_submitted` with `onboarding_completed`, and the second of
 * those is fired minutes later on a different screen, by which time nothing in
 * the session says whether this account came from a password, from Google, or
 * from a guest who was stopped at a gate. A device flag is how that fact
 * travels — the same mechanism `pendingReferrer` uses, for the same reason.
 *
 * Spent at the end of the wizard and cleared with the draft.
 */
export function recordSignupSubmitted(method: SignUpMethod, fromGuest: boolean): void {
  track({ name: 'signup_submitted', properties: { method, from_guest: fromGuest } })
  void writeJsonFlag(FLAG_KEYS.signupOrigin, { method, fromGuest } satisfies SignupOrigin)
}

/** How the account being finished was created, or `null` on a device that never recorded one. */
export async function readSignupOrigin(): Promise<SignupOrigin | null> {
  const stored = await readJsonFlag<Partial<SignupOrigin>>(FLAG_KEYS.signupOrigin)
  if (!stored?.method) return null
  return { method: stored.method, fromGuest: stored.fromGuest === true }
}

export async function clearSignupOrigin(): Promise<void> {
  await clearFlag(FLAG_KEYS.signupOrigin)
}
