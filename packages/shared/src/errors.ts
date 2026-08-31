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
