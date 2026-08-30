import { PASSWORD_MIN_LENGTH, passwordTooShort } from '@langx/shared'
import type { MessageKey } from '../i18n/runtime'

export { PASSWORD_MIN_LENGTH }

/**
 * What to say under the password fields, while they are being typed.
 *
 * Two rules, in the order a person meets them: a password shorter than the
 * minimum is wrong on its own, and one that does not match its confirmation is
 * wrong as a pair. Both are checked here rather than at
 * submit, because "your password is too short" arriving after a round trip
 * has nothing left to point at.
 *
 * Silent on an empty field: an error on a form nobody has filled in yet is
 * noise, not help.
 */
export function passwordIssueKey(password: string, confirmation: string): MessageKey | undefined {
  if (password.length > 0 && passwordTooShort(password)) return 'auth.passwordTooShort'
  if (confirmation.length > 0 && confirmation !== password) return 'auth.passwordsDoNotMatch'
  return undefined
}

/** Whether the pair may be submitted at all. */
export function passwordPairReady(password: string, confirmation: string): boolean {
  return !passwordTooShort(password) && password === confirmation
}
