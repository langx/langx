import { REPORT_REASONS, type ReportReason } from '@langx/shared'

/**
 * A reason as stored, narrowed to one this build can name. Rows filed before
 * a reason existed, or by a newer server, read as `other` rather than as a key
 * the catalogue has no word for.
 */
export function asReportReason(value: string): ReportReason {
  return (REPORT_REASONS as readonly string[]).includes(value) ? (value as ReportReason) : 'other'
}
