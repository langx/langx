import type { FastifyInstance } from 'fastify'
import { ObjectId } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { translator } from '../../i18n'
import { deliverOfficialMessage } from '../official/deliver'
import { localeFor } from '../profiles/localeFor'
import { sendPush, tokensByLocale } from '../push/devices'
import { awardTokens } from '../tokens/ledger'
import type { Report } from './blocks'

/**
 * Thanking somebody for a report about another member, in tokens.
 *
 * `payBounty`'s shape, for `payBounty`'s reasons. `refId` is the report's id,
 * so the ledger's unique `{userId, kind, refId}` index — not a check in here —
 * is what makes a second press worth nothing. Only the award that actually
 * happened stamps the report and tells the person, so neither of those can
 * happen twice either.
 *
 * Any report, whatever was decided about it: whether a report deserved
 * thanks is the operator's judgement, not a consequence of the verdict.
 *
 * `null` for an id that names no report.
 */
export async function rewardReporter(
  app: FastifyInstance,
  input: { reportId: string; amount: number; byAdminId: string },
): Promise<{ awarded: boolean; amount: number; reporterId: string } | null> {
  if (!ObjectId.isValid(input.reportId)) return null
  const reportId = new ObjectId(input.reportId)
  const reports = app.mongo.db.collection<Report>(COLLECTIONS.reports)
  const report = await reports.findOne({ _id: reportId }, { projection: { reporterId: 1 } })
  if (!report) return null

  const result = await awardTokens(app.mongo.db, {
    userId: report.reporterId,
    kind: 'reportReward',
    amount: input.amount,
    refId: input.reportId,
  })

  if (result.awarded) {
    await reports.updateOne(
      { _id: reportId },
      { $set: { reward: { amount: result.amount, at: new Date(), by: input.byAdminId } } },
    )
    await notifyReportRewarded(app, {
      userId: report.reporterId,
      amount: result.amount,
      reportId: input.reportId,
    })
  }

  return { awarded: result.awarded, amount: result.amount, reporterId: report.reporterId }
}

/**
 * A push and a message from @langx — the bounty receipt without its email.
 *
 * No email because this is a thank-you rather than a payment somebody asked
 * for: nobody filed a report expecting tokens, and the thread is the durable
 * record either way. No preference gate, as the bounty has none — it is a
 * receipt for tokens already in the ledger, not a nudge.
 *
 * Neither says what was decided. That belongs to the person the report was
 * about, just as the reporter's name is kept from them.
 *
 * Never throws: the tokens are in the ledger by now, and a push relay's bad
 * minute must not turn the operator's press into an error they would retry.
 */
async function notifyReportRewarded(
  app: FastifyInstance,
  input: { userId: string; amount: number; reportId: string },
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
        title: t('push.reportRewardTitle', { count: input.amount }),
        body: t('push.reportRewardBody'),
        // `bountyPaid` on purpose: to every app already installed it means
        // "tokens landed, open the wallet", and a new kind would land those
        // on whatever their router does with a kind it has never seen.
        data: { kind: 'bountyPaid' },
      })
    }
  } catch (error) {
    warn(error, 'report reward push failed')
  }

  try {
    const locale = await localeFor(db, input.userId)
    await deliverOfficialMessage(db, {
      fromHandle: 'langx',
      toUserId: input.userId,
      body: translator(locale)('official.reportReward', { count: input.amount }),
      // Keyed by the report, so `sender_client_id_unique` refuses a second
      // copy even if the ledger's answer were ever wrong.
      clientId: `reportReward:${input.reportId}`,
    })
  } catch (error) {
    warn(error, 'report reward message failed')
  }
}
