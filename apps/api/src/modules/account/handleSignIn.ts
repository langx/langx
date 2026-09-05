import { handleSchema } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { emailFor } from '../profiles/emailFor'
import type { Profile } from '../profiles/profiles'

/**
 * Whether what somebody typed into the sign-in field is a handle rather than
 * an address.
 *
 * A handle can never contain `@` — `HANDLE_PATTERN` is lowercase letters,
 * digits and underscore — so the two can be told apart without guessing at
 * email syntax, which is the kind of check that eventually rejects somebody's
 * real address. A leading `@` is stripped first because that is what people
 * type when asked for a handle.
 */
export function looksLikeHandle(typed: string): boolean {
  return !normalizeHandle(typed).includes('@')
}

function normalizeHandle(typed: string): string {
  return typed.trim().replace(/^@+/, '').toLowerCase()
}

/**
 * Where an unresolved handle is sent instead.
 *
 * Not cosmetic. Better Auth answers a wrong password and an unknown address
 * identically — 401, and it hashes the password either way so even the timing
 * matches — but it rejects a value that is not an address at all with a 400
 * before any of that. So leaving a handle that matched nothing in the field
 * would have answered "no account has this handle" in the status code, for a
 * name anybody can read off a profile page. Substituting an address that
 * parses but cannot exist puts the miss back on the same path as every other
 * unknown sign-in.
 *
 * `.invalid` is reserved by RFC 2606 and can never be registered, and the
 * subdomain is not the one the anonymous plugin hands guests, so this cannot
 * collide with a real account.
 */
export const UNRESOLVED_HANDLE_EMAIL = 'no-such-handle@handle.langx.invalid'

/**
 * The address behind a handle, for signing in with one.
 *
 * Validated through the *reading* schema, not `newHandleSchema`: a v1 account
 * can hold a three-character handle, and that person has to be able to sign in
 * with the name they already have. A guest's handle is `guest:<id>`, which the
 * schema can never produce, so guests fall out here rather than needing a case
 * of their own.
 *
 * `null` when nothing matches; the caller substitutes
 * `UNRESOLVED_HANDLE_EMAIL` rather than passing the miss through, for the
 * reason documented there.
 */
export async function emailForHandle(db: Db, typed: string): Promise<string | null> {
  const parsed = handleSchema.safeParse(normalizeHandle(typed))
  if (!parsed.success) return null

  const profile = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .findOne({ handle: parsed.data }, { projection: { _id: 1 } })
  if (!profile) return null

  return (await emailFor(db, profile._id))?.email ?? null
}
