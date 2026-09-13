import type { FastifyInstance } from 'fastify'
import { notifyBountyPaid } from './bountyNotice'
import { markFeedbackPaid } from './reports'
import { awardTokens } from '../tokens/ledger'

/**
 * Paying for a confirmed report, from either door.
 *
 * The emailed link and the admin panel both land here, so "paid once" is one
 * fact rather than two implementations of it. `refId` is the report's id, and
 * the ledger's unique `{userId, kind, refId}` index — not a check in here — is
 * what makes a second press, a refresh, a forwarded mail, or the panel and the
 * mail both being used worth nothing.
 */
export interface PayBountyInput {
  userId: string
  /** The feedback report's id, which is also the ledger's `refId`. */
  refId: string
  amount: number
}

export async function payBounty(
  app: FastifyInstance,
  input: PayBountyInput,
): Promise<{ awarded: boolean; amount: number }> {
  const result = await awardTokens(app.mongo.db, {
    userId: input.userId,
    kind: 'bounty',
    amount: input.amount,
    refId: input.refId,
  })

  /*
   * Only on the award that actually happened. The unique index makes that
   * exactly once per report, so a second attempt pays nothing and says nothing
   * either — no second notification, and no need for a claim row to prevent
   * one.
   */
  if (result.awarded) {
    /*
     * `triaged`, not `closed`: paying says the report was real, not that the
     * fix has shipped. And only on the award that happened, so the row cannot
     * gain a second, later `bounty.at` from a press that paid nothing.
     */
    await markFeedbackPaid(app.mongo.db, input.refId, result.amount)
    await notifyBountyPaid(
      app.mongo.db,
      { push: app.push, email: app.email },
      { userId: input.userId, amount: result.amount },
      (err, message) => app.log.warn({ err, userId: input.userId }, message),
    )
  }

  return { awarded: result.awarded, amount: result.amount }
}
