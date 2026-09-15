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
 * How often a username may change: once every `HANDLE_CHANGE_COOLDOWN_DAYS`.
 *
 * This replaced a rule with two halves — "never", and one exception for an
 * account that came back from v1 carrying the `langx_` plus four hex
 * characters v1's generator gave it. That exception was the whole rename
 * story for nine people in ten, and it left the tenth, and everybody who
 * signed up here, with the only remedy the old rule ever had: delete the
 * account. A week per move keeps what the ban was for — a handle is a public
 * address, and one that changes daily is nobody's address — while letting a
 * person correct a name they typed at sign-up, or outgrow one.
 *
 * The first change is free, because nothing writes `handleChangedAt` until
 * a change happens. That is also why there is no migration: every profile
 * that predates the field reads as one that has never changed, which is
 * what it is — including the v1 accounts that already spent their one
 * claim, whose `previousHandle` said so and whose `handleChangedAt` is
 * simply absent.
 *
 * Same shape as `GENDER_CHANGE_COOLDOWN_DAYS`, and both sides read this one:
 * the server's filter refuses on it, the app draws the row on it. A second
 * copy would eventually disagree with the first about when the field frees.
 */
export const HANDLE_CHANGE_COOLDOWN_DAYS = 7
/** Derived, so the number people read and the number the filter uses cannot drift. */
export const HANDLE_CHANGE_COOLDOWN_MS = HANDLE_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000

/**
 * When the username may change again, or `undefined` if it may change now.
 *
 * Derived from the profile rather than from a refused request, so a screen
 * can say "on {date}" before anybody taps; the server's
 * `HANDLE_CHANGE_TOO_SOON` is the backstop for a stale screen, not the way
 * this is normally learned.
 */
export function handleChangeFreeAt(
  profile: { handleChangedAt?: string | Date | null },
  now: number = Date.now(),
): Date | undefined {
  if (!profile.handleChangedAt) return undefined
  const freeAt = new Date(profile.handleChangedAt).getTime() + HANDLE_CHANGE_COOLDOWN_MS
  return freeAt > now ? new Date(freeAt) : undefined
}
