/**
 * Whether a session belongs to a guest.
 *
 * Pure, and kept apart from the routing in `requireAccount.ts` for one
 * mechanical reason: `vitest.config.ts` sees `src/lib/**`, but anything that
 * imports `expo-router` cannot be parsed there. Splitting the decision from the
 * navigation is what makes the decision testable at all — the same shape
 * `swipeToReply` and `manageSubscription` already have.
 *
 * `isAnonymous` is declared by Better Auth's plugin with `input: false`, so
 * nothing a client sends can set it. It is absent on every ordinary session,
 * which is why this asks for `=== true` rather than trusting truthiness: an
 * unknown shape must read as a real account, never as a guest, or somebody gets
 * locked out of their own app.
 */
export function shouldGateGuest(
  user: { isAnonymous?: boolean | null | undefined } | null | undefined,
): boolean {
  return user?.isAnonymous === true
}
