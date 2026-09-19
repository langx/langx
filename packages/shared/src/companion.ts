import { z } from 'zod'
import { localeSchema } from './locales'

/**
 * What the iOS widgets read.
 *
 * The app writes this blob into the App Group container; the widget, the Lock
 * Screen accessories and the watch complications render it and nothing else.
 * None of them makes a network call, which is the whole point: every client
 * here is cookie-based and an app extension has its own container, so a widget
 * that fetched would need a second credential living somewhere a cookie never
 * has. See `docs/plans/iphone-watch-and-carplay.md` → _The widgets, in detail_.
 *
 * Three consequences shape the fields below.
 *
 * **No snapshot means signed out**, and signed out means the widget shows its
 * empty state rather than a zero. A zero is a claim about somebody's streak;
 * absence is not. Sign-out deletes the blob in the same breath it clears the
 * session.
 *
 * **The words come with the numbers.** The app holds eight catalogues and
 * knows which locale the reader is in; the widget would have to be handed the
 * same eight to say "day streak" in Turkish. It is handed the three words
 * instead, already chosen. Only text with no data behind it — the empty state
 * — needs a string catalogue on the Swift side.
 *
 * **`lastQualifiedDay` travels raw**, not as a "counted today" flag. The flag
 * would be computed when the app last wrote and would still say yesterday's
 * answer at one in the morning; the day key lets the widget compare against
 * its own calendar day whenever its timeline wakes. That comparison is a
 * string equality, not a second copy of the streak rules — nothing here
 * re-implements `streakSavable`, and nothing here may.
 */
export const COMPANION_SNAPSHOT_VERSION = 1

export const companionSnapshotSchema = z.object({
  /**
   * Bumped when a field changes meaning. A widget from an older build reads a
   * version it does not know and shows the empty state, which is the honest
   * answer — an update reaches the extension only when the binary does, and
   * the two can be weeks apart on a phone that does not update.
   */
  version: z.literal(COMPANION_SNAPSHOT_VERSION),
  /**
   * When the app last wrote. The widget shows the numbers regardless — a
   * widget is allowed to be a few minutes old — and this is what lets it stop
   * claiming them after a day of the app never being opened.
   */
  writtenAt: z.string().datetime(),
  /** The reader's locale, for number and date formatting on the Swift side. */
  locale: localeSchema,
  /** Total unread conversations, as `GET /me/unread` counts them. */
  unread: z.number().int().nonnegative(),
  streak: z.object({
    current: z.number().int().nonnegative(),
    longest: z.number().int().nonnegative(),
    /**
     * The last day that counted, in the profile's timezone, as the server
     * decides it — `YYYY-MM-DD`, or null for an account that has never had a
     * qualifying day. The widget compares it with the device's own day key;
     * see the note above for why the comparison is not made here.
     */
    lastQualifiedDay: z.string().nullable(),
  }),
  echo: z.object({
    due: z.number().int().nonnegative(),
    /** When the soonest card that is not due yet comes back, or null. */
    nextDue: z.string().nullable(),
  }),
  /**
   * The three words the widget draws beside its three numbers, already in the
   * reader's language. Plural forms are not needed: each label sits under a
   * number rather than inside a sentence, which is the same reason the app's
   * own tiles read "cards due" and not "12 cards due".
   */
  labels: z.object({
    streak: z.string(),
    unread: z.string(),
    cardsDue: z.string(),
  }),
})

export type CompanionSnapshot = z.infer<typeof companionSnapshotSchema>
