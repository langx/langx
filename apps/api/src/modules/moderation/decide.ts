import {
  REVIEW_ACTIONS_BY_KIND,
  type ReviewAction,
  type ReviewDecision,
  type ReviewKind,
} from '@langx/shared'
import type { FastifyInstance } from 'fastify'
import type { ObjectId } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { suspendedEmail, suspensionUpdatedEmail } from '../../email/templates'
import { setPostHidden } from '../feed/feed'
import { emailFor } from '../profiles/emailFor'
import { localeFor } from '../profiles/localeFor'
import { getProfile } from '../profiles/profiles'
import {
  actionReport,
  dismissReport,
  liftSuspension,
  shortenSuspension,
  suspendUser,
} from './suspension'

/**
 * One moderation decision, with no page around it.
 *
 * This is the body of `POST /moderation/review` lifted out of the route so
 * that the signed link in the report email and the admin panel are the same
 * decision rather than two that drift. Everything that made the emailed
 * version safe is here — the kind check, the reversible post actions, the
 * best-effort notice — and the callers differ only in what they render:
 * a sentence of HTML for the mailbox, JSON for the panel.
 *
 * It writes nothing itself. The five repository functions in `suspension.ts`
 * already did all of it, and adding a sixth here would have been the drift
 * this exists to prevent.
 */

export type ReviewOutcome =
  | { action: 'hide_post' | 'unhide_post'; hidden: boolean; changed: boolean }
  | { action: 'dismiss' }
  | { action: 'keep' }
  | { action: 'suspend' | 'permanent'; until: Date; permanent: boolean; reason: string }
  | { action: 'shorten'; until: Date }
  | { action: 'lift' }

/**
 * Why a decision could not be made. Each maps to a different sentence and a
 * different status code, so the callers word them rather than this.
 */
export type ReviewRefusal = 'action_not_allowed' | 'account_gone' | 'not_a_post' | 'post_gone'

export type ReviewDecisionResult =
  | { ok: false; refusal: ReviewRefusal }
  | { ok: true; handle: string | null; outcome: ReviewOutcome }

/**
 * The decision itself is `reviewDecisionSchema`'s own shape — the same object
 * the emailed form posts and the panel sends — plus who it is about.
 */
export interface ReviewDecisionInput extends ReviewDecision {
  kind: ReviewKind
  userId: string
  /** The report being decided, or `null` for an appeal with none behind it. */
  reportId: ObjectId | null
}

export async function applyReviewDecision(
  app: FastifyInstance,
  input: ReviewDecisionInput,
): Promise<ReviewDecisionResult> {
  const { kind, userId, reportId, action, days } = input

  /*
   * The token (or the route) says *which* report or appeal; this says what may
   * be done with it. Both halves are checked, so a report link cannot lift a
   * suspension it was never shown, and an appeal link cannot open a new one.
   */
  if (!(REVIEW_ACTIONS_BY_KIND[kind] as readonly ReviewAction[]).includes(action)) {
    return { ok: false, refusal: 'action_not_allowed' }
  }

  const profile = await getProfile(app.mongo.db, userId)
  if (!profile) return { ok: false, refusal: 'account_gone' }
  const handle = profile.handle ?? null

  /*
   * The two decisions about the post rather than the account, handled before
   * the address lookups below because neither needs one: hiding is silent,
   * which is the whole shape of it.
   */
  if (action === 'hide_post' || action === 'unhide_post') {
    const report = reportId
      ? await app.mongo.db
          .collection(COLLECTIONS.reports)
          .findOne<{ postId?: ObjectId }>({ _id: reportId })
      : null
    if (!report?.postId) return { ok: false, refusal: 'not_a_post' }

    const hidden = action === 'hide_post'
    const before = await setPostHidden(app.mongo.db, report.postId.toHexString(), hidden)
    if (!before) return { ok: false, refusal: 'post_gone' }
    /*
     * Hiding decides the report; showing it again does not reopen it. The
     * second is a correction of the first, and a report that bounced back to
     * `open` would arrive in the next list as work nobody owes.
     */
    if (hidden && reportId) await actionReport(app.mongo.db, reportId)
    return {
      ok: true,
      handle,
      outcome: { action, hidden, changed: Boolean(before.hiddenAt) !== hidden },
    }
  }

  /**
   * Telling the person is never fatal to the decision. The suspension is
   * already written; a mail provider's bad minute must not turn it into a 500
   * that invites the same button being pressed again.
   */
  const tell = async (send: () => Promise<void>) => {
    try {
      await send()
    } catch (error) {
      app.log.warn({ err: error, userId }, 'suspension email failed')
    }
  }

  if (action === 'dismiss') {
    if (reportId) await dismissReport(app.mongo.db, reportId)
    return { ok: true, handle, outcome: { action } }
  }

  if (action === 'keep') {
    return { ok: true, handle, outcome: { action } }
  }

  const address = await emailFor(app.mongo.db, userId)
  const locale = await localeFor(app.mongo.db, userId)

  if (action === 'suspend' || action === 'permanent') {
    const permanent = action === 'permanent'
    /*
     * The reason comes from the report being decided, not from whatever a
     * previous decision stored: this decision is about *this* report, and the
     * person is about to be told which one it was.
     */
    const report = reportId
      ? await app.mongo.db
          .collection(COLLECTIONS.reports)
          .findOne<{ reason: string }>({ _id: reportId })
      : null
    const reason = report?.reason ?? profile.suspension?.reason ?? 'other'
    const until = await suspendUser(app.mongo.db, {
      userId,
      reason,
      ...(permanent ? { permanent: true } : { days: days ?? 1 }),
      ...(reportId ? { reportId } : {}),
    })
    if (address?.verified) {
      await tell(() =>
        app.email.send({
          to: address.email,
          ...suspendedEmail(locale, { until: permanent ? null : until, reason }),
        }),
      )
    }
    return { ok: true, handle, outcome: { action, until, permanent, reason } }
  }

  // `shorten` and `lift` — the two an appeal can drive.
  const until =
    action === 'shorten' ? await shortenSuspension(app.mongo.db, userId, days ?? 1) : null
  if (action === 'lift') await liftSuspension(app.mongo.db, userId)
  if (address?.verified) {
    await tell(() =>
      app.email.send({ to: address.email, ...suspensionUpdatedEmail(locale, { until }) }),
    )
  }
  return until
    ? { ok: true, handle, outcome: { action: 'shorten', until } }
    : { ok: true, handle, outcome: { action: 'lift' } }
}
