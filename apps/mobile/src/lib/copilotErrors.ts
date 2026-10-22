import type { MessageKey } from '../i18n'
import { errorCodeOf, errorStatusOf } from './errors'

/**
 * What a Copilot surface does with a refusal.
 *
 * - `off` — Copilot is not for this person after all: the operator's switch
 *   went off, the account left the allow-list, or it is under age. The card
 *   closes and the button goes, rather than leaving a sentence about a
 *   feature the thread no longer offers.
 * - `consent` — the agreement is gone (withdrawn on another device, or given
 *   to an older version of the sheet). The sheet comes back, and nothing is
 *   sent until it is answered.
 * - otherwise the one line to show.
 *
 * Duck-typed, like `limitCopy.ts`: the error class lives in `api/client`,
 * which vitest cannot load.
 */
export type CopilotErrorKey =
  | 'off'
  | 'consent'
  | Extract<
      MessageKey,
      | 'copilot.errQuota'
      | 'copilot.errQuotaNoTime'
      | 'copilot.errPartnerAge'
      | 'copilot.errBusy'
      | 'copilot.errNoAnswer'
      | 'copilot.errNetwork'
    >

function field(error: unknown, name: 'reason' | 'retryAt'): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const value = (error as Record<string, unknown>)[name]
  return typeof value === 'string' ? value : undefined
}

export function copilotErrorKey(error: unknown): CopilotErrorKey {
  const code = errorCodeOf(error)
  if (code === 'COPILOT_UNAVAILABLE') {
    const reason = field(error, 'reason')
    // `age` reads as off too: the status said available a moment ago, so the
    // birthday has just passed the other way, or the profile changed.
    if (reason === 'off' || reason === 'age') return 'off'
    if (reason === 'partner_age') return 'copilot.errPartnerAge'
    if (reason === 'busy') return 'copilot.errBusy'
    // `no_answer`, and any reason this build has never heard of.
    return 'copilot.errNoAnswer'
  }
  if (code === 'COPILOT_CONSENT_REQUIRED') return 'consent'
  if (code === 'QUOTA_EXCEEDED') {
    return copilotRetryAt(error) ? 'copilot.errQuota' : 'copilot.errQuotaNoTime'
  }
  // No status at all: the request never reached a server.
  if (code === undefined && errorStatusOf(error) === undefined) return 'copilot.errNetwork'
  return 'copilot.errNoAnswer'
}

/**
 * Reply ideas found nothing to reply to — the newest lines were all photos,
 * voice notes or withdrawn. Not a failure worth a sentence: the chip simply
 * goes for that message.
 */
export function copilotEmptyThread(error: unknown): boolean {
  return errorCodeOf(error) === 'VALIDATION_FAILED' && field(error, 'reason') === 'empty_thread'
}

/** The quota's own answer for when the next Copilot answer frees up. */
export function copilotRetryAt(error: unknown): string | undefined {
  return field(error, 'retryAt')
}
