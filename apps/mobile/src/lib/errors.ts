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
