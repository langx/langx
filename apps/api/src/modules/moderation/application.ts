import {
  ERROR_CODES,
  MOD_APPLICATION_MIN_STREAK,
  type ModApplicationInput,
  type ModApplicationStatus,
} from '@langx/shared'
import { randomUUID } from 'node:crypto'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import { recordFeedback, type FeedbackReport } from '../feedback/reports'
import { getProfile } from '../profiles/profiles'

/**
 * Somebody asking to moderate, as a row in the operators' feedback queue.
 *
 * The same queue as bugs and reported Copilot answers because it is the same
 * job — read it, decide, write back, close it — and the account purge already
 * sweeps `feedback` by `userId`. What it shares with the Copilot row rather
 * than the bug is everything it leaves out: no GitHub issue (the tracker is
 * public and these answers are about a person), no bounty link and no mail.
 *
 * Appointing is not done here. It stays `POST /admin/users/:userId/moderator`, so
 * that a form can never make anybody a moderator.
 */

/** Whether this person has an application still waiting. */
export async function modApplicationStatus(db: Db, userId: string): Promise<ModApplicationStatus> {
  const open = await db
    .collection<FeedbackReport>(COLLECTIONS.feedback)
    .findOne(
      { userId, kind: 'modApplication', status: { $ne: 'closed' } },
      { projection: { _id: 1 } },
    )
  return { open: open !== null }
}

/**
 * Files an application, or says why not.
 *
 * The streak is the server's to check: the sheet's disabled button is a
 * courtesy, and a client is free to post here anyway. A second application
 * while one is open is answered as sent and writes nothing, so a double tap
 * or a retry after a dropped response is not a second row to read.
 */
export async function applyToModerate(
  db: Db,
  userId: string,
  input: ModApplicationInput,
): Promise<void> {
  const profile = await getProfile(db, userId)
  if (!profile) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Complete onboarding first')
  if (profile.moderator) throw new ApiError(ERROR_CODES.FORBIDDEN, 'Already a moderator')

  const streak = profile.streak?.current ?? 0
  if (streak < MOD_APPLICATION_MIN_STREAK) {
    throw new ApiError(
      ERROR_CODES.FORBIDDEN,
      `A ${MOD_APPLICATION_MIN_STREAK}-day streak is needed to apply`,
    )
  }

  if ((await modApplicationStatus(db, userId)).open) return

  await recordFeedback(db, {
    _id: randomUUID(),
    userId,
    kind: 'modApplication',
    // The panel reads the answers from `modApplication`; the body is what a
    // reader of the bare row, or the reply draft, sees first.
    body: input.answers.why,
    attachmentUrls: [],
    modApplication: { streak, answers: input.answers },
  })
}
