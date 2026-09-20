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
   * When the app last wrote.
   *
   * Carried, and not yet read: `CompanionSnapshot.load` decides nothing from
   * it, so a blob the app stopped refreshing is still drawn in full. That is
   * deliberate for now — a widget is allowed to be a few minutes old, and no
   * cut-off has been chosen, let alone measured. It is here because the
   * moment one is wanted it has to already be in blobs written by builds that
   * shipped before the rule, and a field added later would be missing from
   * exactly the stale snapshots the rule exists to catch.
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
   * The activity map, as one character per day.
   *
   * **Optional, and the first field added after this schema shipped**, which
   * is what the `version` note above is about: a widget extension is only
   * replaced when the binary is, so an older extension will be handed a blob
   * carrying this and must ignore it rather than fail. Absent means an app
   * that predates the map widget, and the widget draws its empty state.
   *
   * A string rather than an array of objects because the array is the whole
   * cost: 140 days is 140 `{day, intensity}` pairs and about six kilobytes of
   * JSON, against 140 bytes here — in a blob that is rewritten on every read
   * message and every finished review.
   *
   * One character per day, oldest first, seven days to a column exactly as
   * `activityGrid` lays them out: `0`–`4` is the shade, and `.` is a day that
   * has not happened yet, which the grid draws as a gap rather than as an
   * empty square. The widget never recomputes the grid — `activityMap.ts` is
   * where that rule lives and a second copy in Swift would be free to
   * disagree about which square is today.
   */
  activity: z
    .object({
      /** `YYYY-MM-DD`, the server's idea of the reader's local day. */
      today: z.string(),
      /** How many columns the string holds, so Swift does not divide to find out. */
      weeks: z.number().int().positive(),
      days: z.string(),
    })
    .optional(),
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
