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
 * A guest session is not meant to outlive the app being closed. While one
 * does, both `Stack.Protected` branches in the root layout are mounted at once
 * — the only state in which that happens — and `/` resolves to two different
 * screens, `app/index.tsx` and `app/(auth)/index.tsx`. Which one wins is
 * decided by route-file enumeration order rather than by anything this app
 * says, so the returning guest lands somewhere nobody chose. Ending the
 * session at boot is what keeps that state from existing.
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
export function shouldEndGuestSession({
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
