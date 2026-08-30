import { z } from 'zod'

/**
 * The password rule, in one place because three screens and Better Auth all
 * have to agree on it: a rule the client enforces and the server does not is a
 * form that rejects nothing, and one the server enforces and the client does
 * not is an error that arrives after the round trip, with no field to point at.
 *
 * **Length only, and short.** The composition rules everyone remembers —
 * an uppercase, a digit, a symbol — push people towards `Password1!` and
 * towards writing it down; NIST dropped them for that reason. Eight is the
 * number that guidance suggests, six is what was asked for here, and the
 * difference is not what protects this account: email verification, rate
 * limiting on sign-in and a session cookie are.
 */
export const PASSWORD_MIN_LENGTH = 6

/**
 * A ceiling exists so a paste of the wrong buffer fails as a validation error
 * rather than as a hash of a megabyte.
 *
 * Sixty-four rather than the twenty this was first written with. A low ceiling
 * does not make a password rule easier — it is the one number that can reject
 * what a password manager just generated, and it rules out every passphrase,
 * including the one this repo's own tests have always used. The ask was for a
 * rule nobody has to fight; that is the floor's job, and the floor is 6.
 */
export const PASSWORD_MAX_LENGTH = 64

/**
 * Not trimmed, deliberately: a space is a character like any other, and
 * silently dropping the ones at the edges would mean a password that works on
 * the screen that trimmed it and nowhere else.
 */
export const passwordSchema = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH)

/** Which rule a password breaks, or `null` when it breaks none. */
export type PasswordProblem = 'tooShort' | 'tooLong'

/**
 * The same check as the schema, shaped for a form: a key to show under the
 * field while someone is still typing, rather than an exception.
 */
export function passwordProblem(password: string): PasswordProblem | null {
  if (password.length < PASSWORD_MIN_LENGTH) return 'tooShort'
  if (password.length > PASSWORD_MAX_LENGTH) return 'tooLong'
  return null
}
