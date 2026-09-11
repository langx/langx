import { z } from 'zod'
import { isReservedHandle } from './reservedHandles'

/**
 * 3-20 chars, lowercase letters/digits/underscore, must start with a letter —
 * permissive enough to fit v1's existing handles (so legacy claims don't get
 * rejected by a format check the old system never enforced this strictly),
 * strict enough to stay URL- and mention-safe.
 */
export const HANDLE_PATTERN = /^[a-z][a-z0-9_]{2,19}$/

/**
 * The **shortest** handle a new account may claim.
 *
 * Three, which is `HANDLE_PATTERN`'s own minimum — so claiming and reading now
 * agree on length, and the only thing that still separates them is the
 * reserved list.
 *
 * It was four. The argument was that short names collide with routes, and that
 * a floor discourages squatting. The first half was real and is answered
 * properly by `RESERVED_HANDLES` rather than by a length: `api`, `www` and
 * `app` were reserved anyway, a four-letter route (`chat`, `feed`, `post`) is
 * just as much a collision, and `routeLiterals.test.ts` fails CI on a screen
 * added without reserving its name. A length was a proxy for a check that
 * exists. The second half was a guess, and the cost of it was paid by every
 * person whose actual name is three letters.
 */
export const HANDLE_MIN_LENGTH = 3

/**
 * Reading a handle: what may be *resolved*.
 *
 * Deliberately still three characters, and that is not laziness. v1 handles
 * came across under the old rule, so a three-letter account can exist —
 * tightening this schema would make that person's own profile answer 400 on
 * every lookup, including the link they have already shared. Route params,
 * legacy claims and `findProfileByHandleOrId` all validate through here.
 */
export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    HANDLE_PATTERN,
    'Handle must be 3-20 characters: letters, numbers, underscore, starting with a letter',
  )

export type Handle = z.infer<typeof handleSchema>

/**
 * Claiming a handle: what may be *created*.
 *
 * The length floor and the reserved list apply here and only here. Existing
 * accounts are grandfathered by construction — nothing re-validates a handle
 * somebody already holds — which is the whole reason this is a second schema
 * rather than a tightening of the first.
 */
export const newHandleSchema = handleSchema
  .refine((handle) => handle.length >= HANDLE_MIN_LENGTH, {
    message: `Handle must be at least ${HANDLE_MIN_LENGTH} characters`,
  })
  .refine((handle) => !isReservedHandle(handle), {
    message: 'That username is reserved',
  })

/**
 * Whether this account may still swap the username v1 gave it.
 *
 * v1 named people itself. Its generator produced `langx_` plus four hex
 * characters — `langx_6430`, `langx_003c`, `langx_00a5` — and against the
 * staged records that is **2846 of 3164** profiles: nine in ten of everybody
 * coming back is carrying a name a machine picked, and the digits-only ones
 * are not a separate case, just the draws that happened to land on `0-9`.
 *
 * So the offer is not narrowed to a shape. Anyone whose v1 profile came back
 * gets one chance to choose, because the 313 who *did* name themselves chose
 * under v1's rules and years ago, and telling them apart by regex would refuse
 * `langx_david` while allowing `langx_00a5` for no reason a person could
 * explain.
 *
 * **One chance, and `previousHandle` is what counts it** rather than a flag or
 * a counter. The old name has to be kept anyway — old links resolve through it
 * and nobody else may take it — so its presence already says the swap
 * happened, and its absence makes the first one free with no migration. Same
 * shape as `genderChangedAt`, for the same reason.
 *
 * This is the whole rule, and both sides import it: the server refuses on it,
 * and the app draws the row and the welcome-back prompt on it. A second copy
 * would eventually disagree with the first about who is being offered what.
 */
export function canClaimNewHandle(profile: {
  restoredFromV1?: unknown
  previousHandle?: unknown
}): boolean {
  return Boolean(profile.restoredFromV1) && !profile.previousHandle
}
