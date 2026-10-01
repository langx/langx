import type { FastifyInstance } from 'fastify'
import { ObjectId } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { fanOutMessage } from '../../ws/fanOut'
import { deliverOfficialMessage } from '../official/deliver'
import type { Report } from './blocks'
import { actionReport } from './suspension'

/**
 * Warning the reported account from @langx — the rung below a suspension.
 *
 * The ladder is warn, then suspend for some days, then suspend for good, and
 * until this the first rung was a message typed into the search-box screen
 * with nothing on the report to say it had been sent. So the next report
 * against the same person arrived looking like the first.
 *
 * Once per report. The message's `clientId` is keyed by the report, so
 * `sender_client_id_unique` refuses a second copy whatever happens here, and
 * only the call that stamped the report is told it warned. Warning decides the
 * report, as hiding a post does: it was acted on, and an open report that had
 * already been answered would come round again as work nobody owes.
 *
 * `null` for an id that names no report, or when there is no @langx to send
 * from.
 */
export async function warnReported(
  app: FastifyInstance,
  input: { reportId: string; body: string; byAdminId: string },
): Promise<{ warned: boolean; reportedId: string; messageId: string | null } | null> {
  if (!ObjectId.isValid(input.reportId)) return null
  const reportId = new ObjectId(input.reportId)
  const reports = app.mongo.db.collection<Report>(COLLECTIONS.reports)
  const report = await reports.findOne(
    { _id: reportId },
    { projection: { reportedId: 1, warning: 1 } },
  )
  if (!report) return null
  if (report.warning) {
    return {
      warned: false,
      reportedId: report.reportedId,
      messageId: report.warning.messageId?.toHexString() ?? null,
    }
  }

  const delivered = await deliverOfficialMessage(app.mongo.db, {
    fromHandle: 'langx',
    toUserId: report.reportedId,
    body: input.body,
    clientId: `reportWarning:${input.reportId}`,
  })
  if (!delivered) return null

  const stamped = await reports.updateOne(
    { _id: reportId, warning: { $exists: false } },
    {
      $set: {
        warning: { at: new Date(), by: input.byAdminId, messageId: delivered.message._id },
      },
    },
  )
  if (stamped.modifiedCount === 1) {
    await actionReport(app.mongo.db, reportId)
    await fanOutMessage(app, app.io, delivered.conversation, delivered.message, {
      pushWhenAway: true,
    })
  }

  return {
    warned: stamped.modifiedCount === 1,
    reportedId: report.reportedId,
    messageId: delivered.message._id.toHexString(),
  }
}
