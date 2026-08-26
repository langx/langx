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

  // generic
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL: 'INTERNAL',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

export interface ApiErrorBody {
  code: ErrorCode
  message: string
  /** Present on UPGRADE_REQUIRED so the client opens the right contextual paywall. */
  feature?: string
  /** Present on QUOTA_EXCEEDED: ISO timestamp when the next slot frees up. */
  retryAt?: string
  details?: unknown
}

/** HTTP status per code — one table so handlers cannot disagree. */
export const ERROR_STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  EMAIL_NOT_VERIFIED: 403,
  UNDERAGE: 403,
  UPGRADE_REQUIRED: 403,
  QUOTA_EXCEEDED: 402,
  HANDLE_TAKEN: 409,
  HANDLE_RESERVED: 409,
  HANDLE_ALREADY_CLAIMED: 409,
  BLOCKED: 403,
  CONVERSATION_EXISTS: 409,
  NOT_FOUND: 404,
  VALIDATION_FAILED: 400,
  RATE_LIMITED: 429,
  INTERNAL: 500,
}
