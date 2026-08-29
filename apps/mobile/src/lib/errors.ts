import type { MessageKey } from '../i18n'

interface BetterAuthErrorLike {
  // `exactOptionalPropertyTypes` distinguishes "absent" from "explicitly
  // undefined" — the client's error object always has the key, just
  // sometimes with an undefined value, so this must allow that explicitly.
  message?: string | undefined
  code?: string | undefined
}

/**
 * Better Auth's codes, mapped onto our own wording.
 *
 * The `message` beside each code is English, written by a library that has no
 * idea what language this app is being read in — so it is deliberately *not*
 * used. An untranslated sentence in the middle of a translated form is worse
 * than a slightly less specific one: the reader cannot tell whether it is a
 * different error or the same error in a language they were not expecting.
 *
 * Only the codes worth distinguishing are here. Anything else falls back to
 * the caller's generic message, which names the action that failed and is
 * therefore never wrong, only vague.
 */
const AUTH_ERROR_KEYS: Record<string, MessageKey> = {
  INVALID_EMAIL_OR_PASSWORD: 'errors.invalidCredentials',
  USER_ALREADY_EXISTS: 'errors.userExists',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'errors.userExists',
  EMAIL_NOT_VERIFIED: 'errors.emailNotVerified',
  PASSWORD_TOO_SHORT: 'errors.passwordTooShort',
  INVALID_EMAIL: 'errors.invalidEmail',
  INVALID_TOKEN: 'errors.invalidToken',
  EXPIRED_TOKEN: 'errors.invalidToken',
}

/**
 * Every Better Auth client call resolves `{data, error}` rather than throwing.
 * Returns the key to show, or `undefined` when the caller's generic one is the
 * best we can do.
 */
export function authErrorKey(
  error: BetterAuthErrorLike | null | undefined,
): MessageKey | undefined {
  const code = error?.code
  return code ? AUTH_ERROR_KEYS[code] : undefined
}

/**
 * The API's error code, whichever transport the failure came back on.
 *
 * REST rejects with an `ApiRequestError`; a socket ack rejects with a plain
 * `Error` carrying `.code` (`lib/socket.ts`'s `emitWithAck`). Every
 * `instanceof ApiRequestError` check on a socket path was therefore dead —
 * the media quota message in the chat screen had never once been shown.
 * Deliberately structural rather than another `instanceof`: the two error
 * shapes share nothing but this field.
 */
export function errorCodeOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' ? code : undefined
}
