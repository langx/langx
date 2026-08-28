import type { QuotaStatusDto } from '../api/queries'

/**
 * One quota bucket as a line of text.
 *
 * `limit: null` means unlimited on this tier rather than "unknown", so it
 * reads as `∞` rather than as a missing value. The reset time is only shown
 * once the bucket is empty: before that it is the expiry of the oldest of
 * several timestamps, which is not the question anyone is asking.
 */
export function formatQuota(status: QuotaStatusDto): string {
  if (status.limit === null) return '∞'

  const used = `${status.remaining ?? 0} / ${status.limit}`
  if (status.remaining !== 0 || !status.nextAvailableAt) return used

  const at = new Date(status.nextAvailableAt)
  if (Number.isNaN(at.getTime())) return used
  const time = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
  return `${used} · resets ${time}`
}
