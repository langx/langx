/**
 * Error codes are part of the API contract: the client branches on them to
 * decide whether to show a paywall, a quota sheet or a generic failure. Never
 * change a code's meaning — add a new one.
 */
export const ERROR_CODES = {
  // auth
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  /**
   * A guest tried to do something that needs an account of their own.
   *
   * Distinct from `UNAUTHENTICATED` because the answer is different: that one
   * means "sign in", this one means "you are browsing as a guest, and this
   * needs an account" — an offer rather than an error. The client turns it into
   * the sign-up screen instead of a toast.
   */
  GUEST_ACCOUNT: 'GUEST_ACCOUNT',
  UNDERAGE: 'UNDERAGE',
  /**
   * This account is suspended. Every route refuses it except the two that let
   * the person read the suspension and appeal it once.
   *
   * The third code the client turns into a whole screen rather than a toast,
   * beside `MAINTENANCE` and `UPDATE_REQUIRED` — and the only one of the three
   * that is about the reader rather than about the service. The body carries
   * `until` and `permanent` so the screen can say when it ends without a
   * second request, the way `retryAt` rides on `RATE_LIMITED`.
   */
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  /**
   * A signed-in account that is not a moderator asked for something under
   * `/admin`.
   *
   * Its own code rather than `FORBIDDEN` because the client's answer is to
   * hide the entry and forget it ever drew one — the flag on
   * `GET /profiles/me` is what normally decides that, and this is the stale
   * client and the hostile one.
   *
   * The message carries no detail on purpose. The repository is public, so the
   * routes are already known, and confirming which of them exist for whom
   * gains nothing.
   */
  ADMIN_REQUIRED: 'ADMIN_REQUIRED',

  // entitlement + quota
  UPGRADE_REQUIRED: 'UPGRADE_REQUIRED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  /**
   * Asked to *set* a first password on an account that already has one.
   * Its own code rather than a generic 409 because the app's answer is a
   * specific one: send them to "change password", which asks for the current
   * one, instead of repeating a form that can never succeed.
   */
  PASSWORD_ALREADY_SET: 'PASSWORD_ALREADY_SET',

  // handles
  HANDLE_TAKEN: 'HANDLE_TAKEN',
  HANDLE_RESERVED: 'HANDLE_RESERVED',
  /**
   * A username change inside `HANDLE_CHANGE_COOLDOWN_DAYS` of the last one.
   * The same shape as `GENDER_CHANGE_TOO_SOON` below, for the same reasons:
   * the body was fine, the answer is a date (`retryAt`), and the client
   * normally knows before it asks because `handleChangedAt` is on the profile.
   */
  HANDLE_CHANGE_TOO_SOON: 'HANDLE_CHANGE_TOO_SOON',

  // chat / social graph
  BLOCKED: 'BLOCKED',
  /**
   * A message to an account that is suspended.
   *
   * Its own code rather than `ACCOUNT_SUSPENDED`, which is about the *reader*
   * and which the client turns into the whole suspended screen — reusing it
   * here would lock out the person who tried to write. Not `FORBIDDEN` either:
   * the client's answer is specific (say the account is suspended, and put the
   * composer away), and it can only give it if this is its own code.
   */
  RECIPIENT_SUSPENDED: 'RECIPIENT_SUSPENDED',
  /** A conversation between these two already exists — see `conversations.pairKey`. */
  CONVERSATION_EXISTS: 'CONVERSATION_EXISTS',
  /**
   * A first message to somebody who has `privacy.refuseNewChats` on.
   *
   * Its own code for `RECIPIENT_SUSPENDED`'s reason: the client's answer is
   * specific — say so, and put the composer away — and `FORBIDDEN` would
   * leave it showing the server's English sentence instead.
   */
  NEW_CHATS_REFUSED: 'NEW_CHATS_REFUSED',
  /**
   * A photo or voice note to somebody who has not yet sent you
   * `MEDIA_UNLOCKS_AFTER_RECEIVED_MESSAGES` messages.
   *
   * Its own code rather than `VALIDATION_FAILED` because the request is
   * well-formed and the fix is not in it — the client has to say *how many
   * more*, and it can only know to do that if this is its own code. Not
   * `UPGRADE_REQUIRED` either: there is nothing to buy. The rule applies to
   * every account on every plan, which is the whole of what makes it worth
   * saying out loud.
   */
  MEDIA_LOCKED: 'MEDIA_LOCKED',
  /**
   * An attachment whose content type we do not serve — `image/heic` from an
   * iPhone camera roll is the one that actually happens.
   *
   * Its own code rather than `VALIDATION_FAILED` because the client's answer
   * is specific ("use a JPEG, PNG or WebP") and, on the picker paths, the
   * request was well-formed: the phone chose the format, not the person. The
   * generic "could not be sent" hid this for a whole test cycle.
   */
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  /** An attachment over its kind's `MEDIA_LIMITS.maxBytes`. Same reasoning as above. */
  MEDIA_TOO_LARGE: 'MEDIA_TOO_LARGE',
  /**
   * An attachment longer than its kind's `MEDIA_LIMITS.maxSeconds`.
   *
   * Its own code rather than `MEDIA_TOO_LARGE` because a sixty-one-second clip
   * of six megabytes is not large, and the answer is different: trim it, do
   * not re-encode it. Folding the two together is exactly the mistake
   * `UNSUPPORTED_MEDIA_TYPE` was split out to undo.
   */
  MEDIA_TOO_LONG: 'MEDIA_TOO_LONG',

  // calls
  /**
   * A call to somebody who has not yet sent you
   * `MEDIA_UNLOCKS_AFTER_RECEIVED_MESSAGES` messages.
   *
   * The media gate's rule and the media gate's number, under its own code
   * because the sentence is different: `MEDIA_LOCKED` is worded about photos
   * and voice notes, and a client that reused it would tell somebody their
   * call needed a photo to unlock. `max` rides along, as it does there.
   */
  CALLS_LOCKED: 'CALLS_LOCKED',
  /**
   * One of the two has calls switched off. `reason` says which — `you` or
   * `them` — because the answers differ: one is a setting to change, the
   * other is somebody's choice to respect.
   */
  CALLS_REFUSED: 'CALLS_REFUSED',
  /**
   * They are on another call. Worded to the caller as "can't take a call
   * right now", never as "is on a call": who somebody is talking to, or that
   * they are talking at all, is theirs.
   */
  CALL_BUSY: 'CALL_BUSY',
  /**
   * The caller is already in a call — on this device or another one signed in
   * to the same account. One account, one live call: it is an index, and this
   * is what the index says when it refuses.
   */
  CALL_IN_PROGRESS: 'CALL_IN_PROGRESS',
  /**
   * The two called each other at once. The call that got there first is
   * already ringing on this device, so the client answers that one instead of
   * starting a second.
   */
  CALL_GLARE: 'CALL_GLARE',
  /**
   * Something was asked of a call that is already over — an answer after the
   * caller gave up, a rejoin after the lease ran out. Its own code rather
   * than `NOT_FOUND` because the screen's answer is "the call ended", which
   * is not what a missing thing says.
   */
  CALL_ENDED: 'CALL_ENDED',
  /**
   * Too many unanswered calls to this person today. `retryAt` says when the
   * oldest of them stops counting; the person writing or calling back clears
   * it sooner.
   */
  CALL_COOLDOWN: 'CALL_COOLDOWN',
  /**
   * Nothing of theirs could be rung: no phone registered for calls and no
   * open app that can take one. The thread still records that somebody
   * tried, which is the part the other person can act on.
   */
  CALL_UNREACHABLE: 'CALL_UNREACHABLE',
  /**
   * This deployment cannot place calls — no relay is configured, or calling
   * has been switched off. The client normally never sees it: `/app-config`
   * says so first and no button is drawn.
   */
  CALLS_UNAVAILABLE: 'CALLS_UNAVAILABLE',

  // testimonials
  /**
   * A testimonial about somebody this pair has not earned the right to write
   * about yet — not enough messages from each side, the thread too new, no
   * thread at all, or an official account on either end.
   *
   * One code for all of those on purpose: the client says one thing ("keep
   * talking") and never how far along the pair is, because a progress bar on
   * praise is an invitation to farm it. 409 because the request is fine and
   * the conflict is with the state of the conversation.
   */
  TESTIMONIAL_LOCKED: 'TESTIMONIAL_LOCKED',
  /**
   * An edit to a testimonial a moderator removed.
   *
   * Its own code rather than `NOT_FOUND`, because the author's own list still
   * shows the row marked removed, and "not found" about a thing on screen is
   * a lie. Rewriting it is refused rather than allowed to bring it back: the
   * decision was about the words, and an edit is how they would return.
   */
  TESTIMONIAL_REMOVED: 'TESTIMONIAL_REMOVED',

  // profiles
  /**
   * A gender change inside `GENDER_CHANGE_COOLDOWN_DAYS` of the last one.
   *
   * Its own code rather than `VALIDATION_FAILED` because the body was fine and
   * the answer is a date: the client has to say *when* they can change it
   * again, and it can only know to do that if this is its own code. 409 for
   * the same reason `LOCATION_REQUIRED` is — the conflict is with the state of
   * the account, not with anything in the request.
   *
   * The client normally never sees it: `genderChangedAt` is on the profile, so
   * the screen knows the field is on cooldown before anybody taps. This is for
   * the stale client and for two taps that race.
   */
  GENDER_CHANGE_TOO_SOON: 'GENDER_CHANGE_TOO_SOON',

  // discovery
  /**
   * `sort=nearby` from someone who has not shared a location. Distinct from
   * `VALIDATION_FAILED` because the request is well-formed and the fix is not
   * in it: the client has to send the user to the location toggle, which it
   * can only know to do if this is its own code. 409 for the same reason the
   * handle codes are — the conflict is with the state of the account, not
   * with anything in the request.
   */
  LOCATION_REQUIRED: 'LOCATION_REQUIRED',

  // billing
  /**
   * A gift code that could not be redeemed. One code with a `reason` from
   * `GIFT_CODE_REJECTIONS` rather than eight codes, because the client's
   * answer is the same shape every time — a sentence under the field — and
   * only the sentence differs. 409: the request was well-formed; the conflict
   * is with the code's state or the account's.
   */
  GIFT_CODE_REJECTED: 'GIFT_CODE_REJECTED',

  // generic
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  RATE_LIMITED: 'RATE_LIMITED',
  /** The service is deliberately down. The client shows a maintenance screen, not an error. */
  MAINTENANCE: 'MAINTENANCE',
  /** This client is older than the minimum the server will serve — see appConfig.minVersion. */
  UPDATE_REQUIRED: 'UPDATE_REQUIRED',
  INTERNAL: 'INTERNAL',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

export interface ApiErrorBody {
  code: ErrorCode
  message: string
  /** Present on UPGRADE_REQUIRED so the client opens the right contextual paywall. */
  feature?: string
  /**
   * Present on an `UPGRADE_REQUIRED` that is a *number* rather than a
   * capability — a language allowance, say. Kept apart from `feature` because
   * that one must be a `PlanFeature`, and those are exactly the booleans
   * `hasFeature` can read. A quota is not one of them.
   */
  limit?: string
  /** The allowance that was exceeded, so the client can say it without guessing. */
  max?: number
  /**
   * Present on `ACCOUNT_SUSPENDED`: when it ends, ISO, or `null` when it does
   * not. `permanent` is not derivable from the sentinel date without teaching
   * the client what the sentinel is, so it is sent.
   */
  until?: string | null
  permanent?: boolean
  /** Present on QUOTA_EXCEEDED: ISO timestamp when the next slot frees up. */
  retryAt?: string
  /**
   * Which rule refused an otherwise well-formed request, when one `code` covers
   * several and the client words them differently — "this post is not asking
   * for that" against "an ask needs words", both `VALIDATION_FAILED`.
   *
   * Its own field rather than something inside `details`, because `details` is
   * already taken: the global handler fills it with zod's issue list on every
   * schema failure, and a client reading a reason out of that would be parsing
   * zod. Optional and additive, so a build that predates it keeps branching on
   * `code` and shows exactly what it showed before. An absent `reason` means
   * "no more specific answer" and deserves a generic sentence, not a guess.
   */
  reason?: string
  details?: unknown
}

/** HTTP status per code — one table so handlers cannot disagree. */
export const ERROR_STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  EMAIL_NOT_VERIFIED: 403,
  GUEST_ACCOUNT: 403,
  UNDERAGE: 403,
  ACCOUNT_SUSPENDED: 403,
  ADMIN_REQUIRED: 403,
  UPGRADE_REQUIRED: 403,
  QUOTA_EXCEEDED: 402,
  MEDIA_LOCKED: 409,
  UNSUPPORTED_MEDIA_TYPE: 415,
  MEDIA_TOO_LARGE: 413,
  MEDIA_TOO_LONG: 413,
  PASSWORD_ALREADY_SET: 409,
  HANDLE_TAKEN: 409,
  HANDLE_RESERVED: 409,
  HANDLE_CHANGE_TOO_SOON: 409,
  BLOCKED: 403,
  RECIPIENT_SUSPENDED: 403,
  CONVERSATION_EXISTS: 409,
  NEW_CHATS_REFUSED: 403,
  GENDER_CHANGE_TOO_SOON: 409,
  LOCATION_REQUIRED: 409,
  GIFT_CODE_REJECTED: 409,
  CALLS_LOCKED: 409,
  CALLS_REFUSED: 403,
  CALL_BUSY: 409,
  CALL_IN_PROGRESS: 409,
  CALL_GLARE: 409,
  CALL_ENDED: 409,
  CALL_COOLDOWN: 429,
  CALL_UNREACHABLE: 409,
  CALLS_UNAVAILABLE: 503,
  TESTIMONIAL_LOCKED: 409,
  TESTIMONIAL_REMOVED: 409,
  NOT_FOUND: 404,
  VALIDATION_FAILED: 400,
  RATE_LIMITED: 429,
  MAINTENANCE: 503,
  UPDATE_REQUIRED: 426,
  INTERNAL: 500,
}
