import { z } from 'zod'

/**
 * The password rule, in one place because three screens and Better Auth all
 * have to agree on it: a rule the client enforces and the server does not is a
 * form that rejects nothing, and one the server enforces and the client does
 * not is an error that arrives after the round trip, with no field to point at.
 *
 * **A minimum, and nothing else.** The composition rules everyone remembers —
 * an uppercase, a digit, a symbol — push people towards `Password1!` and
 * towards writing it down; NIST dropped them for that reason. There is no
 * maximum either: a ceiling is the one number that can reject what a password
 * manager just generated, and what protects this account is email
 * verification, rate limiting on sign-in and a session cookie. Better Auth
 * keeps its own 128-character guard against a megabyte being pasted into a
 * hash, which is a different thing from a rule anybody is meant to read.
 */
export const PASSWORD_MIN_LENGTH = 6

/**
 * Not trimmed, deliberately: a space is a character like any other, and
 * silently dropping the ones at the edges would mean a password that works on
 * the screen that trimmed it and nowhere else.
 */
export const passwordSchema = z.string().min(PASSWORD_MIN_LENGTH)

/** Shaped for a form: true while there is still something to say under it. */
export function passwordTooShort(password: string): boolean {
  return password.length < PASSWORD_MIN_LENGTH
}
