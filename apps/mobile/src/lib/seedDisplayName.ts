/**
 * Whether the account's name should be dropped into an empty onboarding draft,
 * and what to drop in.
 *
 * Pure and separate from the screen because the ordering is the whole point
 * and it is invisible when wrong. `hydrateDraft` merges the stored draft
 * *underneath* anything this session has touched, so a name written before
 * hydration finishes counts as touched and quietly beats the one the person
 * typed on an earlier launch. Nothing would look broken; they would just find
 * a different name than the one they left.
 *
 * Returns `null` for "leave it alone", which covers every case that is not
 * "hydrated, nothing typed yet, and an account name to offer".
 */
export function displayNameToSeed(input: {
  /** What the draft holds right now. */
  current: string
  /** The name on the account — from sign-up, or from Google or Apple. */
  accountName: string
  /** Whether the stored draft has been merged in yet. */
  hydrated: boolean
  /** Whether this has already run once for this screen. */
  alreadySeeded: boolean
}): string | null {
  if (input.alreadySeeded || !input.hydrated) return null
  const account = input.accountName.trim()
  if (account.length === 0) return null
  // A draft with something in it is somebody's answer, whether they typed it
  // now or two launches ago.
  if (input.current.trim().length > 0) return null
  return account
}
