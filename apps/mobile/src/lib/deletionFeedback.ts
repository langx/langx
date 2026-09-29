import type { AccountDeletionReason } from '@langx/shared'

/**
 * What the delete-account screen adds to its request from the "why are you
 * leaving?" step: only what was actually answered.
 *
 * Skipping sends nothing at all, so the request is exactly the one an older
 * build sends — the server reads an absent answer as no answer, which is the
 * whole meaning of "optional".
 */
export function deletionFeedbackPayload(
  reason: AccountDeletionReason | null,
  note: string,
): { reason?: AccountDeletionReason; note?: string } {
  const trimmed = note.trim()
  return {
    ...(reason ? { reason } : {}),
    ...(trimmed ? { note: trimmed } : {}),
  }
}
