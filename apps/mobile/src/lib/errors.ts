interface BetterAuthErrorLike {
  // `exactOptionalPropertyTypes` distinguishes "absent" from "explicitly
  // undefined" — the client's error object always has the key, just
  // sometimes with an undefined value, so this must allow that explicitly.
  message?: string | undefined
}

/** Every Better Auth client call resolves `{data, error}` rather than throwing. */
export function authErrorMessage(
  error: BetterAuthErrorLike | null | undefined,
): string | undefined {
  return error?.message
}

/**
 * The API's error code, whichever transport the failure came back on.
 *
 * REST rejects with an `ApiRequestError`; a socket ack rejects with a plain
 * `Error` carrying `.code` (`lib/socket.ts`'s `emitWithAck`). Every
 * `instanceof ApiRequestError` check on a socket path was therefore dead —
 * the media quota message in the chat screen had never once been shown.
 * Deliberately structural rather than another `instanceof`: the two error
 * shapes share nothing but this field.
 */
export function errorCodeOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' ? code : undefined
}
