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

/**
 * Step one of the two-step deletion: the viewer types their own handle, and
 * the server sends the confirming link.
 *
 * The handle rather than a literal like `DELETE`: a word every user of every
 * app types without reading is not a gate, and their own handle is the one
 * string that cannot be typed by somebody who picked up the phone.
 */
export const deletionRequestSchema = z.object({
  handle: z.string().trim().min(1).max(64),
})
export type DeletionRequestInput = z.infer<typeof deletionRequestSchema>

/**
 * What that request answers.
 *
 * `deliverable: false` means the deployment cannot send mail at all — no
 * `RESEND_API_KEY`, so every message lands in a log — and the app must then
 * fall back to the direct `POST /me/delete`. In-app deletion is an App Store
 * requirement and cannot be allowed to depend on email being configured.
 */
export const deletionRequestResultSchema = z.object({
  sent: z.boolean(),
  deliverable: z.boolean(),
})
export type DeletionRequestResult = z.infer<typeof deletionRequestResultSchema>

/**
 * Whether what somebody typed is their own handle.
 *
 * Shared so the screen and the route agree exactly: case is not significant —
 * handles are stored lowercase — and a leading `@` is what half the world
 * types when asked for one. Anything else is a mismatch, deliberately: this is
 * the last gate before an account ends.
 */
export function handlesMatch(typed: string, actual: string): boolean {
  const clean = (value: string): string => value.trim().replace(/^@+/, '').toLowerCase()
  return clean(typed).length > 0 && clean(typed) === clean(actual)
}

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
