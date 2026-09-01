/**
 * Whether the cache in hand belongs to somebody else now.
 *
 * The QueryClient is built once, at the root, and nothing below it ever
 * unmounts — so every answer fetched for one account is still sitting in it
 * when the next one arrives. React Query hands cached data to the first screen
 * that asks for it, before any refetch can disagree, which is how somebody who
 * signed out and started browsing as a guest was shown the previous account's
 * conversation list. The rows were real; they were just not theirs.
 *
 * Pure, and apart from the layout that calls it, for the reason `guestGate`
 * gives: `vitest.config.ts` sees `src/lib/**` and nothing that imports
 * `expo-router`, so the decision is testable only when it is separate from the
 * `queryClient.clear()` it triggers.
 *
 * Three states, not two, which is the whole reason this is not `a !== b`:
 *
 * - `undefined` — nobody observed yet. This is the first render of every
 *   launch, while `useSession` is still resolving. Nothing has been cached
 *   under anyone, so there is nothing to drop.
 * - `null` — observed, and signed out. Also nothing to drop: the cache was
 *   already emptied on the way out.
 * - an id — observed, and somebody's. Anything else arriving after this is a
 *   switch, including `null`: signing out has to drop the cache, or the next
 *   account inherits it.
 *
 * Better Auth keeps `data` across a refetch (it only nulls it on a 401), so an
 * id going missing here means the session really ended rather than that it is
 * being re-checked — and a 401 has ended it too.
 */
export function isAccountSwitch(seen: string | null | undefined, current: string | null): boolean {
  if (seen === undefined || seen === null) return false
  return seen !== current
}
