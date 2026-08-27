import { z } from 'zod'

/**
 * Grace period between "delete my account" and the data actually going.
 *
 * Both stores require deletion to be *possible* in-app; neither requires it to
 * be instant, and an immediate irreversible wipe turns one angry tap into
 * permanent data loss. Thirty days is long enough to change your mind and
 * short enough to be a real deletion rather than a suspension.
 */
export const ACCOUNT_DELETION_GRACE_DAYS = 30

export const deleteAccountSchema = z.object({
  /** Typed confirmation, so this cannot be an accidental POST. */
  confirm: z.literal('DELETE'),
  reason: z.string().trim().max(500).optional(),
})
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>

export const accountDeletionStatusSchema = z.object({
  pending: z.boolean(),
  deletedAt: z.string().nullable(),
  /** When the data is actually removed; until then a sign-in cancels it. */
  purgeAt: z.string().nullable(),
})
export type AccountDeletionStatus = z.infer<typeof accountDeletionStatusSchema>

/** Everything we hold about one user, in one JSON document (GDPR portability). */
export const dataExportSchema = z.object({
  exportedAt: z.string(),
  profile: z.unknown(),
  conversations: z.array(z.unknown()),
  messages: z.array(z.unknown()),
  tokenLedger: z.array(z.unknown()),
  subscriptions: z.array(z.unknown()),
  blocks: z.array(z.unknown()),
  profileViews: z.array(z.unknown()),
  devices: z.array(z.unknown()),
})
export type DataExport = z.infer<typeof dataExportSchema>
