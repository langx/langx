import { router } from 'expo-router'
import { shouldGateGuest } from './guestGate'

/**
 * The one place that turns "a guest tried to do something" into a route.
 *
 * Deliberately the same shape as `openPaywall`, and for the reason its comment
 * gives: every call site pushing the bare route is how one of them ends up
 * forgetting. `if (!requireAccount(user)) return` at the top of a write handler
 * reads as a guard and cannot be half-applied.
 *
 * Returns `true` when the caller may proceed, so the common case is one line
 * and the uncommon one is already handled.
 */
export function requireAccount(
  user: { isAnonymous?: boolean | null | undefined } | null | undefined,
): boolean {
  if (!shouldGateGuest(user)) return true
  router.push('/(auth)/sign-up')
  return false
}
