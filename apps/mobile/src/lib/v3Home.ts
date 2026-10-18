/**
 * Whether this launch runs the redesign's Home and its five tabs, decided
 * once and then kept.
 *
 * `flags.v3Home` is read off `/app-config`, which is refetched every time the
 * app comes back to the foreground. Read live, an operator turning the flag
 * on would rearrange the tab bar under somebody's thumb the next time they
 * came back from another app — tabs moving places mid-session, and Feed gone
 * from where it was a minute ago. So the first settled answer is the answer
 * for the life of this JS runtime: a change reaches a running app at its next
 * cold start, or on the web at the next page load.
 *
 * "Settled" includes a failed request. An unreachable config is today's tabs,
 * the same as a flag that is off, and it stays today's tabs until the next
 * launch rather than switching the moment the network comes back.
 *
 * Module state rather than React state, because the answer has to outlive the
 * tab layout: signing out unmounts it, and signing back in must not be the
 * moment the bar changes either.
 *
 * `undefined` until the first settled answer — a caller that can wait (Home's
 * own route, which would otherwise send itself to Discover) tells "not yet"
 * from "off"; everything else reads it as off.
 */
let latched: boolean | undefined

export function latchV3Home(answer: { settled: boolean; on: boolean }): boolean | undefined {
  if (latched === undefined && answer.settled) latched = answer.on
  return latched
}

/** For tests: forget the answer, as a cold start would. */
export function resetV3HomeLatch(): void {
  latched = undefined
}
