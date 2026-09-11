import { clearFlag, FLAG_KEYS, readJsonFlag, writeJsonFlag } from './localFlags'

/**
 * What a guest was about to do when the account gate stopped them.
 *
 * One kind today, and the shape is a discriminated union so a second one — a
 * post, a correction — is an addition rather than a rewrite of everything that
 * reads this.
 */
export type PendingIntent = { kind: 'message'; toUserId: string }

/**
 * Remembers who a guest wanted to talk to, across registering.
 *
 * Wanting to message somebody is the strongest reason this app ever gives a
 * stranger to make an account, and it used to be dropped at the exact moment
 * it peaked: the gate pushed a blank sign-up form, and eight screens later the
 * person landed on a generic "find someone" button with no memory of the
 * someone they had already found.
 *
 * A device flag rather than anything on the account, for the same reason
 * `pendingReferrer` is one: it is captured before there is an account.
 *
 * Unlike `pendingReferrer` it deliberately survives `resetDraft` — the profile
 * is created on the handle step and the offer is made two screens later, so
 * clearing it there would clear it before it could ever be spent. `take()` is
 * how it is spent instead: read and cleared in one call, so it can be offered
 * once and cannot greet the next person who signs up on this phone.
 */
export async function writePendingMessageIntent(toUserId: string): Promise<void> {
  await writeJsonFlag(FLAG_KEYS.pendingIntent, {
    kind: 'message',
    toUserId,
  } satisfies PendingIntent)
}

/** Reads the intent and clears it, so it is offered exactly once. */
export async function takePendingIntent(): Promise<PendingIntent | null> {
  const stored = await readJsonFlag<Partial<PendingIntent>>(FLAG_KEYS.pendingIntent)
  await clearFlag(FLAG_KEYS.pendingIntent)
  if (stored?.kind !== 'message' || typeof stored.toUserId !== 'string' || !stored.toUserId) {
    return null
  }
  return { kind: 'message', toUserId: stored.toUserId }
}
