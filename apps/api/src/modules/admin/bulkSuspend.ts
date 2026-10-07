import type { AdminBulkSkip, AdminBulkSuspendInput, AdminBulkSuspendResult } from '@langx/shared'
import type { FastifyBaseLogger, FastifyInstance } from 'fastify'
import { applyReviewDecision } from '../moderation/decide'
import { isSuspended } from '../moderation/suspension'
import { getProfile } from '../profiles/profiles'
import { recordAdminAction } from './auditLog'

/**
 * Suspends several accounts with one reason and one length — the linked
 * accounts of somebody who came back under new handles.
 *
 * Each one goes through `applyReviewDecision`, exactly as the single
 * suspension does, so the notice, the ended call and the shape of the stored
 * suspension are the same whichever button did it. This adds only the refusals
 * a list needs and a single account screen never did: the operator's own
 * account, another operator, and the official accounts can sit in a linked
 * list (a shared office network is enough) and must not be swept up with it;
 * and an account already suspended is left as it is, because a new
 * suspension replaces the old one and would turn a permanent one into days.
 *
 * One at a time rather than in parallel: fifty suspensions means fifty mails
 * and fifty call teardowns, and there is no hurry that justifies sending them
 * all in the same instant.
 */
export async function suspendMany(
  app: FastifyInstance,
  log: FastifyBaseLogger,
  adminId: string,
  input: AdminBulkSuspendInput,
): Promise<AdminBulkSuspendResult[]> {
  const results: AdminBulkSuspendResult[] = []
  const skip = (userId: string, skipped: AdminBulkSkip) =>
    results.push({ userId, suspended: false, skipped })

  for (const userId of input.userIds) {
    if (userId === adminId) {
      skip(userId, 'self')
      continue
    }
    const profile = await getProfile(app.mongo.db, userId)
    if (!profile) {
      skip(userId, 'not_found')
      continue
    }
    if (profile.admin === true) {
      skip(userId, 'admin')
      continue
    }
    if (profile.official === true) {
      skip(userId, 'official')
      continue
    }
    if (isSuspended(profile)) {
      skip(userId, 'suspended')
      continue
    }

    /*
     * One failure must not hide the others. Without the catch, the twentieth
     * account's error would answer 500 for a request that had already
     * suspended nineteen — and the obvious response, pressing it again, would
     * mail those nineteen a second time.
     */
    try {
      const result = await applyReviewDecision(app, {
        kind: 'report',
        userId,
        reportId: null,
        action: 'suspend',
        days: input.days,
        reason: input.reason,
        byAdminId: adminId,
      })
      if (!result.ok) {
        skip(userId, 'not_found')
        continue
      }
    } catch (error) {
      log.warn({ err: error, userId }, 'bulk suspension of one account failed')
      skip(userId, 'failed')
      continue
    }

    await recordAdminAction(app.mongo.db, log, {
      adminId,
      action: 'user.suspend',
      subjectUserId: userId,
      payload: { reason: input.reason, days: input.days, bulk: true },
    })
    results.push({ userId, suspended: true })
  }
  return results
}
