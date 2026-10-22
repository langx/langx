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
 * "Settled" includes a failed request, and one still going after
 * `V3_HOME_WAIT_MS`. An unreachable config is today's tabs, the same as a
 * flag that is off, and it stays today's tabs until the next launch rather
 * than switching the moment the network comes back.
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

// The 3.0 TestFlight build: the redesign is the app, so the server's
// `flags.v3Home` is ignored and every launch takes v3 from the first render.
// This branch is not merged to main; production builds still follow the flag.
export function latchV3Home(_answer: { settled: boolean; on: boolean }): boolean | undefined {
  latched = true
  return latched
}

/**
 * The latched answer, read without subscribing to anything — for components
 * drawn many times over, such as `Avatar`, where a hook per instance would be
 * a config subscription per face in a list. Everything that draws them sits
 * behind the launch splash, which waits for the latch, so by then it is set;
 * before it is set this is off, as everywhere else.
 */
export function v3HomeLatched(): boolean {
  return latched === true
}

/**
 * The longest a launch waits for the config before deciding without it.
 *
 * The launch splash holds for this answer, so without a ceiling a request
 * that neither answers nor fails — a captive portal, a tunnel the phone still
 * calls online, a hotspot that drops packets — kept a returning person on the
 * splash for as long as the request took to give up, where before the flag
 * their stored profile let them straight in. One try of `/app-config` is a
 * round trip of a few hundred milliseconds; past this, the launch is today's
 * tabs, as an unreachable config always was, and the latch keeps it so.
 */
export const V3_HOME_WAIT_MS = 1_500

let waitStartedAt: number | undefined

/**
 * How much of the wait is left at `now`, in milliseconds. The clock starts at
 * the first call — the first screen that asks, at launch — and is shared by
 * every caller after it, so a screen mounted late does not start a wait of
 * its own.
 */
export function v3HomeWaitLeft(now: number): number {
  waitStartedAt ??= now
  return Math.max(0, waitStartedAt + V3_HOME_WAIT_MS - now)
}

/*
 * The latch as a store, for `useSyncExternalStore`.
 *
 * `useV3Home()` is read in about a hundred components, leaves included, and
 * each used to be a config query subscription of its own — so every refetch
 * of `/app-config`, which happens on every return to the foreground,
 * re-rendered all of them to hand back an answer that cannot change. One
 * component at the root now watches the config and latches; everything else
 * subscribes here, hears at most one change for the life of the runtime, and
 * after that reads a constant.
 */
const listeners = new Set<() => void>()

export function subscribeV3Home(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The latched answer, `undefined` until there is one. */
export function v3HomeSnapshot(): boolean | undefined {
  return latched
}

let announced: boolean | undefined

/**
 * Tells the subscribers the latch has an answer. Separate from `latchV3Home`
 * because that runs during the root's render, and waking other components
 * from inside a render is an update React refuses; the root calls this from
 * an effect instead. Once per launch: later calls find nothing new to say.
 */
export function announceV3Home(): void {
  if (latched === undefined || announced === latched) return
  announced = latched
  for (const listener of listeners) listener()
}

/** For tests: forget the answer and the wait, as a cold start would. */
export function resetV3HomeLatch(): void {
  latched = undefined
  waitStartedAt = undefined
  announced = undefined
  listeners.clear()
}
