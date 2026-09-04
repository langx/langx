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

  // entitlement + quota
  UPGRADE_REQUIRED: 'UPGRADE_REQUIRED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  // handles
  HANDLE_TAKEN: 'HANDLE_TAKEN',
  HANDLE_RESERVED: 'HANDLE_RESERVED',
  HANDLE_ALREADY_CLAIMED: 'HANDLE_ALREADY_CLAIMED',

  // chat / social graph
  BLOCKED: 'BLOCKED',
  /** A conversation between these two already exists — see `conversations.pairKey`. */
  CONVERSATION_EXISTS: 'CONVERSATION_EXISTS',
  /**
   * A photo or voice note into a conversation that has not exchanged
   * `MEDIA_UNLOCKS_AFTER_MESSAGES` messages yet.
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
  /** Present on QUOTA_EXCEEDED: ISO timestamp when the next slot frees up. */
  retryAt?: string
  details?: unknown
}

/** HTTP status per code — one table so handlers cannot disagree. */
export const ERROR_STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  EMAIL_NOT_VERIFIED: 403,
  GUEST_ACCOUNT: 403,
  UNDERAGE: 403,
  UPGRADE_REQUIRED: 403,
  QUOTA_EXCEEDED: 402,
  MEDIA_LOCKED: 409,
  UNSUPPORTED_MEDIA_TYPE: 415,
  MEDIA_TOO_LARGE: 413,
  MEDIA_TOO_LONG: 413,
  HANDLE_TAKEN: 409,
  HANDLE_RESERVED: 409,
  HANDLE_ALREADY_CLAIMED: 409,
  BLOCKED: 403,
  CONVERSATION_EXISTS: 409,
  LOCATION_REQUIRED: 409,
  NOT_FOUND: 404,
  VALIDATION_FAILED: 400,
  RATE_LIMITED: 429,
  MAINTENANCE: 503,
  UPDATE_REQUIRED: 426,
  INTERNAL: 500,
}
