import { ERROR_CODES } from '@langx/shared'
import type { Db } from 'mongodb'
import { ApiError } from '../../lib/ApiError'
import type { TranslationProvider } from '../../translation/TranslationProvider'
import { getAppConfig } from '../appConfig/appConfig'
import type { Conversation, Message } from '../chat/conversations'
import { isOfficialId } from '../official/accounts'
import { captureFromMessage } from './cards'

/**
 * What the automatic capture did — returned for the tests and nothing else.
 * Every outcome is silent to both people.
 */
export type CorrectionCaptureOutcome = 'off' | 'created' | 'kept' | 'capped' | 'skipped'

/**
 * A provider that never answers, so `backFor` falls through to its empty back.
 *
 * Automatic capture must not reach Google. The privacy declaration says the
 * text sent for translation is "the text you asked to translate", and nobody
 * asked; it would also bill a sentence per correction to an account that may
 * never open the card. What a capture can still use costs nothing and sends
 * nothing: a translation already on the message, or one already in the shared
 * cache. Otherwise the card is kept with an empty back, as a capture already
 * is when no key is configured.
 */
const NO_PROVIDER: TranslationProvider = {
  translate: () =>
    Promise.reject(new Error('Automatic capture does not call the translation provider')),
}

/**
 * A correction somebody received, kept in their Echo without a tap.
 *
 * The same `captureFromMessage` the "Add echo" tap runs, for the person whose
 * sentence was corrected — the other participant — so the access check, the
 * front (the corrected text), the language and the daily ceiling are one
 * definition. `card_source_unique` makes a second run of this one a no-op,
 * and a later tap on the same correction writes no second card and spends
 * nothing — it only fills the back this left empty, the tap being a person
 * asking (see `upsertCard`).
 *
 * Behind `flags.echoFromCorrections`, which stays off until the app ships the
 * "Saved to your Echo · Undo" toast and the setting beside it.
 *
 * **Never throws.** The correction is what the corrector asked for, and it is
 * already stored when this runs; nothing here may turn it into an error. A
 * full `echoCapturesPerDay` is skipped without a word — never an alert, never
 * the paywall — and so is anything the capture refuses (a block since, a
 * corrected person who has gone). Anything unexpected is logged, not raised.
 */
export async function captureReceivedCorrection(
  db: Db,
  conversation: Conversation,
  correction: Message,
): Promise<CorrectionCaptureOutcome> {
  try {
    if (!(await getAppConfig(db)).flags.echoFromCorrections) return 'off'
    if (correction.type !== 'correction') return 'skipped'

    const correctedId = conversation.participants.find((id) => id !== correction.senderId)
    // Our own accounts keep no cards: the assistant learns nothing from Echo.
    if (!correctedId || isOfficialId(correctedId)) return 'skipped'

    const result = await captureFromMessage(db, { translation: NO_PROVIDER }, correctedId, {
      conversationId: conversation._id.toHexString(),
      messageId: correction._id.toHexString(),
    })
    return result.created ? 'created' : 'kept'
  } catch (caught) {
    if (caught instanceof ApiError) {
      return caught.code === ERROR_CODES.QUOTA_EXCEEDED ? 'capped' : 'skipped'
    }
    console.error('[echo] automatic correction capture failed', {
      messageId: correction._id.toHexString(),
      error: caught,
    })
    return 'skipped'
  }
}
