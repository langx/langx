import {
  shortDisplayName,
  type AdminModActionListQuery,
  type ModReportAction,
  type ModeratorListItem,
  type ReportReason,
  type ReviewAction,
} from '@langx/shared'
import type { FastifyInstance } from 'fastify'
import { ObjectId, type Db, type Document, type Filter } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { suspensionUpdatedEmail } from '../../email/templates'
import { translator } from '../../i18n'
import {
  partiesFor,
  toObjectId,
  type AdminParty,
  type AdminReportDetail,
  type AdminReportRow,
  type Page,
} from '../admin/reports'
import { deliverOfficialMessage } from '../official/deliver'
import { emailFor } from '../profiles/emailFor'
import { localeFor } from '../profiles/localeFor'
import type { Profile } from '../profiles/profiles'
import { sendPush, tokensByLocale } from '../push/devices'
import { awardTokens } from '../tokens/ledger'
import type { Report } from './blocks'
import { applyReviewDecision } from './decide'
import { liftSuspension, notSuspended } from './suspension'

/**
 * Moderators, and the record of what they decided.
 *
 * A moderator is a member, not one of us, so nothing they do is final until
 * an operator has looked at it. Every decision writes a row here with the
 * reason the moderator gave; the operator panel lists the rows nobody has
 * reviewed, and from there an operator approves one, undoes it, or thanks the
 * moderator for it in tokens. The decision itself still goes through
 * `applyReviewDecision`, so a moderator's suspension is the same suspension an
 * operator's would be — only who may make which one differs.
 */

export type ModeratorActionName = ModReportAction | 'warn'

export interface ModeratorAction {
  _id: ObjectId
  moderatorId: string
  reportId: ObjectId
  /** The reported account, which every action here is about. */
  subjectUserId: string
  action: ModeratorActionName
  days?: number
  /** Required for a suspension, kept for anything else that had one. */
  note?: string
  /** The reason whose prepared warning was sent, for `warn`. */
  warningReason?: ReportReason
  at: Date
  /** Absent until an operator has looked. Its absence is the queue. */
  review?: { status: 'approved' | 'reverted'; by: string; at: Date }
  /** What the moderator was thanked with. Written only by the award that happened. */
  reward?: { amount: number; by: string; at: Date }
}

const actions = (db: Db) => db.collection<ModeratorAction>(COLLECTIONS.moderatorActions)
const profiles = (db: Db) => db.collection<Profile>(COLLECTIONS.profiles)

export async function recordModeratorAction(
  db: Db,
  entry: Omit<ModeratorAction, '_id' | 'at'>,
): Promise<ObjectId> {
  const _id = new ObjectId()
  await actions(db).insertOne({ ...entry, _id, at: new Date() })
  return _id
}

// ── who a moderator may act on ────────────────────────────────────────────

/**
 * Accounts no moderator may decide about: operators, the official accounts,
 * and other moderators. A moderator suspending another one is a dispute
 * between two people we picked, and that is ours to settle. Small — a
 * handful of rows — so it is read whole rather than joined.
 */
async function protectedIds(db: Db): Promise<string[]> {
  const rows = await profiles(db)
    .find(
      {
        $or: [{ admin: true }, { official: true }, { moderator: { $exists: true } }],
      },
      { projection: { _id: 1 } },
    )
    .toArray()
  return rows.map((row) => row._id)
}

/**
 * The open reports a moderator may see. Not one about themselves, nor one they
 * filed — deciding your own report is not reviewing it — nor one about a
 * protected account.
 */
export async function moderatorReportScope(db: Db, moderatorId: string): Promise<Filter<Report>> {
  return {
    status: 'open',
    reporterId: { $ne: moderatorId },
    reportedId: { $nin: [...(await protectedIds(db)), moderatorId] },
  }
}

// ── what a moderator is shown ─────────────────────────────────────────────

/**
 * A moderator never learns who filed a report. "The person you reported is
 * never told who sent it" is a promise we make to every reporter, and a
 * moderator is a member who could be either of them tomorrow. So the reporter
 * is dropped, and every message is labelled by side rather than by account.
 */
export type ModReportRow = Omit<AdminReportRow, 'reporter'>

type Side = 'reported' | 'reporter'

export type ModReportDetail = Omit<
  AdminReportDetail,
  'reporter' | 'reward' | 'message' | 'thread' | 'testimonial' | 'suspension'
> & {
  message: (Omit<NonNullable<AdminReportDetail['message']>, 'senderId'> & { from: Side }) | null
  thread: {
    messages: (Omit<NonNullable<AdminReportDetail['thread']>['messages'][number], 'senderId'> & {
      from: Side
    })[]
  } | null
  /** The review's words; whose profile it sits on would name the reporter. */
  testimonial: { id: string; body: string; hidden: boolean } | null
  /** Only what is in force — not the appeal, nor who decided it. */
  suspension: { until: string | null; permanent: boolean } | null
}

export function toModReportRow(row: AdminReportRow): ModReportRow {
  const { reporter: _reporter, ...rest } = row
  return rest
}

export function toModReportDetail(detail: AdminReportDetail): ModReportDetail {
  const {
    reporter: _reporter,
    reward: _reward,
    message,
    thread,
    testimonial,
    suspension,
    ...rest
  } = detail
  const side = (senderId: string): Side =>
    senderId === detail.reported.userId ? 'reported' : 'reporter'
  return {
    ...rest,
    message: message ? (({ senderId, ...m }) => ({ ...m, from: side(senderId) }))(message) : null,
    thread: thread
      ? {
          messages: thread.messages.map(({ senderId, ...m }) => ({ ...m, from: side(senderId) })),
        }
      : null,
    testimonial: testimonial
      ? {
          id: testimonial.id,
          body: testimonial.body,
          hidden: Boolean(testimonial.ownerHiddenAt ?? testimonial.moderatorHiddenAt),
        }
      : null,
    suspension:
      suspension && new Date(suspension.until).getTime() > Date.now()
        ? {
            until: suspension.permanent ? null : new Date(suspension.until).toISOString(),
            permanent: suspension.permanent,
          }
        : null,
  }
}

// ── the role ──────────────────────────────────────────────────────────────

export type GrantModeratorResult =
  | { ok: true; changed: boolean }
  | { ok: false; refusal: 'not_found' | 'official' | 'suspended' | 'deleted' }

/**
 * Making somebody a moderator. An operator may hold the role too — they can
 * already do all of it, so it only adds the MOD chip and a place in the public
 * list. Refused for an official account, which is not a person, and for an
 * account that is suspended or leaving.
 */
export async function grantModerator(
  db: Db,
  userId: string,
  byAdminId: string,
): Promise<GrantModeratorResult> {
  const profile = await profiles(db).findOne(
    { _id: userId },
    { projection: { official: 1, suspension: 1, deletedAt: 1, moderator: 1 } },
  )
  if (!profile) return { ok: false, refusal: 'not_found' }
  if (profile.official) return { ok: false, refusal: 'official' }
  if (profile.deletedAt) return { ok: false, refusal: 'deleted' }
  if (profile.suspension && new Date(profile.suspension.until).getTime() > Date.now()) {
    return { ok: false, refusal: 'suspended' }
  }
  const result = await profiles(db).updateOne(
    { _id: userId, moderator: { $exists: false } },
    { $set: { moderator: { since: new Date(), by: byAdminId }, updatedAt: new Date() } },
  )
  return { ok: true, changed: result.modifiedCount === 1 }
}

export async function revokeModerator(db: Db, userId: string): Promise<boolean> {
  const result = await profiles(db).updateOne(
    { _id: userId, moderator: { $exists: true } },
    { $unset: { moderator: '' }, $set: { updatedAt: new Date() } },
  )
  return result.modifiedCount === 1
}

/**
 * Who moderates, for everybody: Settings lists them so a member can tell a
 * moderator's chip from a made-up one. A suspended or leaving moderator is
 * left off, as they are left out of every other list.
 */
export async function listPublicModerators(db: Db): Promise<ModeratorListItem[]> {
  const rows = await profiles(db)
    .find(
      { moderator: { $exists: true }, deletedAt: { $exists: false }, ...notSuspended() },
      { projection: { handle: 1, displayName: 1, avatarUrl: 1, moderator: 1 } },
    )
    .sort({ 'moderator.since': 1 })
    .toArray()
  return rows.map((row) => ({
    userId: row._id,
    handle: row.handle ?? null,
    displayName: shortDisplayName(row.displayName ?? row.handle),
    avatarUrl: row.avatarUrl ?? null,
    since: (row.moderator?.since ?? row.createdAt).toISOString(),
  }))
}

// ── the operator's review ─────────────────────────────────────────────────

export interface ModActionRow {
  id: string
  action: ModeratorActionName
  days: number | null
  note: string | null
  warningReason: ReportReason | null
  at: string
  reportId: string
  reportReason: string | null
  moderator: AdminParty
  subject: AdminParty
  review: { status: 'approved' | 'reverted'; at: string } | null
  reward: { amount: number; at: string } | null
}

const TAB_FILTER: Record<AdminModActionListQuery['status'], Document> = {
  // An equality on `null` matches the missing field, and the index serves it.
  pending: { 'review.status': null },
  approved: { 'review.status': 'approved' },
  reverted: { 'review.status': 'reverted' },
}

export async function listModActions(
  db: Db,
  query: AdminModActionListQuery,
  now: Date = new Date(),
): Promise<Page<ModActionRow>> {
  const cursor = query.cursor ? toObjectId(query.cursor) : null
  const rows = await actions(db)
    .find({
      ...TAB_FILTER[query.status],
      ...(query.moderatorId ? { moderatorId: query.moderatorId } : {}),
      ...(cursor ? { _id: { $lt: cursor } } : {}),
    })
    .sort({ _id: -1 })
    .limit(query.limit + 1)
    .toArray()
  const page = rows.slice(0, query.limit)

  const [parties, reports] = await Promise.all([
    partiesFor(
      db,
      page.flatMap((row) => [row.moderatorId, row.subjectUserId]),
      now,
    ),
    db
      .collection<Report>(COLLECTIONS.reports)
      .find({ _id: { $in: page.map((row) => row.reportId) } }, { projection: { reason: 1 } })
      .toArray(),
  ])
  const reasons = new Map(reports.map((report) => [report._id.toHexString(), report.reason]))

  return {
    items: page.map((row) => ({
      id: row._id.toHexString(),
      action: row.action,
      days: row.days ?? null,
      note: row.note ?? null,
      warningReason: row.warningReason ?? null,
      at: row.at.toISOString(),
      reportId: row.reportId.toHexString(),
      reportReason: reasons.get(row.reportId.toHexString()) ?? null,
      moderator: parties.get(row.moderatorId)!,
      subject: parties.get(row.subjectUserId)!,
      review: row.review ? { status: row.review.status, at: row.review.at.toISOString() } : null,
      reward: row.reward ? { amount: row.reward.amount, at: row.reward.at.toISOString() } : null,
    })),
    nextCursor: rows.length > query.limit ? (page.at(-1)?._id.toHexString() ?? null) : null,
  }
}

export interface ModeratorSummary extends AdminParty {
  since: string
  total: number
  pending: number
  approved: number
  reverted: number
  /** Tokens paid for their decisions, in total. */
  rewarded: number
}

/** Every moderator, with the record the operator judges them by. */
export async function listModeratorSummaries(
  db: Db,
  now: Date = new Date(),
): Promise<ModeratorSummary[]> {
  const mods = await profiles(db)
    .find({ moderator: { $exists: true } }, { projection: { moderator: 1 } })
    .sort({ 'moderator.since': 1 })
    .toArray()
  if (mods.length === 0) return []
  const ids = mods.map((mod) => mod._id)

  const [parties, counts] = await Promise.all([
    partiesFor(db, ids, now),
    actions(db)
      .aggregate<{
        _id: string
        total: number
        pending: number
        approved: number
        reverted: number
        rewarded: number
      }>([
        { $match: { moderatorId: { $in: ids } } },
        {
          $group: {
            _id: '$moderatorId',
            total: { $sum: 1 },
            pending: { $sum: { $cond: [{ $ifNull: ['$review', false] }, 0, 1] } },
            approved: { $sum: { $cond: [{ $eq: ['$review.status', 'approved'] }, 1, 0] } },
            reverted: { $sum: { $cond: [{ $eq: ['$review.status', 'reverted'] }, 1, 0] } },
            rewarded: { $sum: { $ifNull: ['$reward.amount', 0] } },
          },
        },
      ])
      .toArray(),
  ])
  const byId = new Map(counts.map((row) => [row._id, row]))

  return mods.map((mod) => {
    const count = byId.get(mod._id)
    return {
      ...parties.get(mod._id)!,
      since: mod.moderator!.since.toISOString(),
      total: count?.total ?? 0,
      pending: count?.pending ?? 0,
      approved: count?.approved ?? 0,
      reverted: count?.reverted ?? 0,
      rewarded: count?.rewarded ?? 0,
    }
  })
}

/** Approving only what nobody has reviewed: a reverted decision stays reverted. */
export async function approveModAction(
  db: Db,
  id: string,
  byAdminId: string,
): Promise<'approved' | 'already_reviewed' | 'not_found'> {
  const _id = toObjectId(id)
  if (!_id) return 'not_found'
  const result = await actions(db).updateOne(
    { _id, review: { $exists: false } },
    { $set: { review: { status: 'approved', by: byAdminId, at: new Date() } } },
  )
  if (result.modifiedCount === 1) return 'approved'
  return (await actions(db).countDocuments({ _id })) ? 'already_reviewed' : 'not_found'
}

/** What undoes each decision. A warning cannot be unsent, so it has none. */
const UNDO: Partial<Record<ModeratorActionName, ReviewAction>> = {
  hide_post: 'unhide_post',
  unhide_post: 'hide_post',
  hide_comment: 'unhide_comment',
  unhide_comment: 'hide_comment',
  hide_testimonial: 'unhide_testimonial',
  unhide_testimonial: 'hide_testimonial',
}

/**
 * Undoing a moderator's decision, and putting the report back in the queue so
 * an operator can make the right one.
 *
 * Claimed first, by the filter, so two presses cannot both undo. An approved
 * decision can still be reverted — an operator may change their mind — but a
 * reverted one is never reverted again.
 *
 * A suspension is lifted only while it is still *this* decision's: if
 * somebody has suspended the account again since, over another report, that
 * is not the moderator's to take back. The person is told by the same mail an
 * appeal that was granted sends.
 */
export async function revertModAction(
  app: FastifyInstance,
  id: string,
  byAdminId: string,
): Promise<
  { ok: true; action: ModeratorAction } | { ok: false; refusal: 'not_found' | 'already_reverted' }
> {
  const db = app.mongo.db
  const _id = toObjectId(id)
  if (!_id) return { ok: false, refusal: 'not_found' }
  const action = await actions(db).findOneAndUpdate(
    { _id, 'review.status': { $ne: 'reverted' } },
    { $set: { review: { status: 'reverted', by: byAdminId, at: new Date() } } },
  )
  if (!action) {
    return (await actions(db).countDocuments({ _id }))
      ? { ok: false, refusal: 'already_reverted' }
      : { ok: false, refusal: 'not_found' }
  }

  if (action.action === 'suspend') {
    const profile = await profiles(db).findOne(
      { _id: action.subjectUserId },
      { projection: { suspension: 1 } },
    )
    const suspension = profile?.suspension
    if (
      suspension?.byModerator &&
      suspension.by === action.moderatorId &&
      suspension.reportId?.equals(action.reportId)
    ) {
      await liftSuspension(db, action.subjectUserId)
      try {
        const address = await emailFor(db, action.subjectUserId)
        if (address?.verified) {
          const locale = await localeFor(db, action.subjectUserId)
          await app.email.send({
            to: address.email,
            ...suspensionUpdatedEmail(locale, { until: null }),
          })
        }
      } catch (error) {
        app.log.warn({ err: error, userId: action.subjectUserId }, 'lift email failed')
      }
    }
  }

  const undo = UNDO[action.action]
  if (undo) {
    await applyReviewDecision(app, {
      kind: 'report',
      userId: action.subjectUserId,
      reportId: action.reportId,
      action: undo,
      byAdminId,
    })
  }

  await db
    .collection<Report>(COLLECTIONS.reports)
    .updateOne({ _id: action.reportId }, { $set: { status: 'open' } })
  return { ok: true, action }
}

/**
 * Thanking a moderator for one decision, in tokens. `rewardReporter`'s shape:
 * `refId` is the decision's id, so the ledger's unique index is what pays it
 * once. Any decision, reviewed or not and whatever the review said — whether
 * it deserved thanks is the operator's judgement.
 */
export async function rewardModAction(
  app: FastifyInstance,
  input: { id: string; amount: number; byAdminId: string },
): Promise<{ awarded: boolean; amount: number; moderatorId: string } | null> {
  const _id = toObjectId(input.id)
  if (!_id) return null
  const action = await actions(app.mongo.db).findOne({ _id }, { projection: { moderatorId: 1 } })
  if (!action) return null

  const result = await awardTokens(app.mongo.db, {
    userId: action.moderatorId,
    kind: 'moderatorReward',
    amount: input.amount,
    refId: input.id,
  })
  if (result.awarded) {
    await actions(app.mongo.db).updateOne(
      { _id },
      { $set: { reward: { amount: result.amount, by: input.byAdminId, at: new Date() } } },
    )
    await notifyModeratorRewarded(app, {
      userId: action.moderatorId,
      amount: result.amount,
      actionId: input.id,
    })
  }
  return { awarded: result.awarded, amount: result.amount, moderatorId: action.moderatorId }
}

/** The report reward's push and @langx message, worded for a moderator. Never throws. */
async function notifyModeratorRewarded(
  app: FastifyInstance,
  input: { userId: string; amount: number; actionId: string },
): Promise<void> {
  const db = app.mongo.db
  const warn = (err: unknown, message: string) =>
    app.log.warn({ err, userId: input.userId }, message)

  try {
    const byLocale = await tokensByLocale(db, input.userId)
    for (const [locale, tokens] of byLocale) {
      if (tokens.length === 0) continue
      const t = translator(locale)
      await sendPush(db, app.push, {
        to: tokens,
        title: t('push.moderatorRewardTitle', { count: input.amount }),
        body: t('push.moderatorRewardBody'),
        // `bountyPaid` for the reason `notifyReportRewarded` gives.
        data: { kind: 'bountyPaid' },
      })
    }
  } catch (error) {
    warn(error, 'moderator reward push failed')
  }

  try {
    const locale = await localeFor(db, input.userId)
    await deliverOfficialMessage(db, {
      fromHandle: 'langx',
      toUserId: input.userId,
      body: translator(locale)('official.moderatorReward', { count: input.amount }),
      clientId: `moderatorReward:${input.actionId}`,
    })
  } catch (error) {
    warn(error, 'moderator reward message failed')
  }
}
