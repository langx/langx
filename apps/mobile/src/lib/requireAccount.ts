import { router } from 'expo-router'
import { track } from './analytics'
import type { GuestGateAction } from './analyticsEvents'
import { shouldGateGuest } from './guestGate'
import { writePendingMessageIntent } from './pendingIntent'

/**
 * What the guest was trying to do.
 *
 * `message` carries who they were writing to, because that is the one intent
 * worth resuming after they register — "you wanted to like Yuki" is not a
 * first action anybody comes back for. Every other action says only what it
 * was, which is what the funnel needs to rank the gates.
 */
export type AccountGate =
  { action: 'message'; toUserId: string } | { action: Exclude<GuestGateAction, 'message'> }

/**
 * The one place that turns "a guest tried to do something" into a route.
 *
 * Deliberately the same shape as `openPaywall`, and for the reason its comment
 * gives: every call site pushing the bare route is how one of them ends up
 * forgetting. `if (!requireAccount(user, gate)) return` at the top of a write
 * handler reads as a guard and cannot be half-applied.
 *
 * The gate is required rather than optional so that a new call site has to say
 * what it is — an unnamed gate would arrive in the funnel as one more
 * `other`, which is the same as not counting it.
 *
 * Returns `true` when the caller may proceed, so the common case is one line
 * and the uncommon one is already handled.
 */
export function requireAccount(
  user: { isAnonymous?: boolean | null | undefined } | null | undefined,
  gate: AccountGate,
): boolean {
  if (!shouldGateGuest(user)) return true
  track({ name: 'guest_gate_hit', properties: { action: gate.action } })
  // Written before the push, so it is already there whichever way the sign-up
  // goes — including the social paths, which leave the app entirely.
  if (gate.action === 'message') void writePendingMessageIntent(gate.toUserId)
  router.push('/(auth)/sign-up')
  return false
}
