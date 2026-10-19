import { COPILOT_RULES, ERROR_CODES } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import type { Profile } from '../profiles/profiles'

/**
 * Whether this person's text may reach the model.
 *
 * Agreement to the **current** sheet only: a consent recorded against an
 * older version was given to other words, and asking again is the price of
 * changing them (`COPILOT_RULES.consentVersion`).
 */
export function hasCopilotConsent(profile: Pick<Profile, 'copilotConsent'>): boolean {
  return profile.copilotConsent?.version === COPILOT_RULES.consentVersion
}

/**
 * Records that the person agreed, from their own tap on the sheet.
 *
 * The version they send must be the one on offer. An old build showing old
 * words would otherwise record agreement to a sheet that no longer exists —
 * so it is refused, and the build that knows the current words asks.
 */
export async function recordCopilotConsent(
  db: Db,
  userId: string,
  version: number,
  now: Date = new Date(),
): Promise<void> {
  if (version !== COPILOT_RULES.consentVersion) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'That is not the current consent sheet', {
      reason: 'stale_consent',
    })
  }
  const result = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .updateOne({ _id: userId }, { $set: { copilotConsent: { version, at: now } } })
  if (result.matchedCount === 0) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 'Complete onboarding first')
  }
}

/**
 * Takes the agreement back. As easy as giving it, and it takes effect on the
 * next request: nothing more of theirs goes to the model. Answers already in
 * `copilotCache` are linked to no account and expire on their own.
 */
export async function withdrawCopilotConsent(db: Db, userId: string): Promise<void> {
  await db
    .collection<Profile>(COLLECTIONS.profiles)
    .updateOne({ _id: userId }, { $unset: { copilotConsent: '' } })
}
