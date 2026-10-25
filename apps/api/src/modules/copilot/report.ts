import { ERROR_CODES, type CopilotReportRequest } from '@langx/shared'
import type { Db } from 'mongodb'
import { ApiError } from '../../lib/ApiError'
import { recordCopilotReport } from '../feedback/reports'
import { getProfile } from '../profiles/profiles'
import { hasCopilotConsent } from './consent'

/**
 * A person reporting one of Copilot's answers to them.
 *
 * Only an account that has agreed to Copilot's sheet: nobody else has been
 * shown an answer, so for anybody else this would be a free-text door into
 * the operators' queue. The flag is not asked about — an answer somebody saw
 * before it went off is still worth hearing about.
 */
export async function reportCopilotAnswer(
  db: Db,
  userId: string,
  report: CopilotReportRequest,
): Promise<void> {
  const profile = await getProfile(db, userId)
  if (!profile) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Complete onboarding first')
  if (!hasCopilotConsent(profile)) {
    throw new ApiError(ERROR_CODES.FORBIDDEN, 'Copilot is not available to this account')
  }
  await recordCopilotReport(db, userId, report)
}
