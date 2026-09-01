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
  /**
   * The community feed. Missing since the feed shipped — the export enumerates
   * collections by hand, and nothing checks that the list is complete.
   */
  posts: z.array(z.unknown()),
  postCorrections: z.array(z.unknown()),
  postComments: z.array(z.unknown()),
  pronunciationAnswers: z.array(z.unknown()),
  likes: z.array(z.unknown()),
  /** Who this user follows; not who follows them, which is other people's data. */
  follows: z.array(z.unknown()),
})
export type DataExport = z.infer<typeof dataExportSchema>

/**
 * `POST /auth/login` — the one endpoint the sign-in screen calls.
 *
 * It tries the normal Better Auth sign-in first and only falls back to the v1
 * bridge when that fails *and* the address belongs to a staged v1 account. A
 * returning user types the password they have always used and lands signed in
 * with their profile already restored; a new user's password never leaves this
 * system.
 */
export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
})
export type LoginInput = z.infer<typeof loginSchema>

export const loginResultSchema = z.object({
  /** True when the v1 bridge was what accepted the password. UI can say "welcome back". */
  migratedFromV1: z.boolean(),
  /** Present when a v1 profile came back with the sign-in. */
  restored: z
    .object({
      handle: z.string(),
      tokensCredited: z.number().int(),
      frozenStreak: z.number().int(),
    })
    .nullable(),
})
export type LoginResult = z.infer<typeof loginResultSchema>
