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

/**
 * Whether a launch has found a guest session that predates it.
 *
 * Looking around without an account is a thing you do in one sitting, and most
 * people who do it never come back — so the session left behind is usually an
 * anonymous `user` row that will never be read again. `useGuestSessionReset`
 * uses this to find those at the next launch; whether it actually ends one
 * depends on how far the guest got, which only the server knows.
 *
 * Three inputs rather than one, because the *timing* is the whole decision:
 *
 * - `settled` — `useSession` has answered. Before that, `user` is absent for
 *   everyone and a guest is indistinguishable from a stranger.
 * - `seenBefore` — a session was already observed during this launch. This is
 *   what separates a restored guest from one that "look around" has just
 *   created a moment ago, which must be left alone.
 * - `user` — a guest, by the same strict check `shouldGateGuest` makes.
 */
export function isRestoredGuestSession({
  settled,
  seenBefore,
  user,
}: {
  settled: boolean
  seenBefore: boolean
  user: { isAnonymous?: boolean | null | undefined } | null | undefined
}): boolean {
  if (!settled || seenBefore) return false
  return shouldGateGuest(user)
}
