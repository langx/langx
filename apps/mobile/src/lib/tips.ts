/**
 * Which tips a person has already dismissed, and whether they want any.
 *
 * Two separate decisions, kept separate: "I have read this one" is per tip,
 * "stop showing me these" is one switch. Collapsing them would mean dismissing
 * a single tip either silences every tip or nothing.
 *
 * Pure, so `vitest.config.ts` reaches it. The storage and the React wiring live
 * in the hook; the rules live here.
 */

/**
 * Every tip, grouped by the place that shows it.
 *
 * A screen asks for a *slot*, not a tip. Before this, `Tip` took an id and a
 * message key together, which made one id mean one fixed sentence — so a
 * screen could only ever teach the same thing, and the chat taught it on every
 * single visit until it was dismissed. Three of the four ids declared here were
 * translated into all eight languages and rendered nowhere at all.
 *
 * Order within a slot is the order they are shown in.
 */
export const TIP_SLOTS = {
  chat: ['chatCorrect', 'chatSwipeReply', 'chatStar', 'chatTranslate', 'chatVoice'],
  chats: ['chatsSwipe', 'chatsPin', 'chatsUnreplied'],
  discover: ['discoverFilters', 'discoverRadius', 'discoverSearch'],
  feed: ['feedAsk', 'feedCorrect', 'feedPronounce'],
  /**
   * The line under the chat composer, which is not a `Tip`: it has no dismiss
   * button and half a row to live in, so its entries are four words rather
   * than a sentence. It rotates through the same cursor because the problem
   * was the same one — it said "hold a message to correct it" forever, beneath
   * a yellow tip saying exactly that.
   */
  composer: ['composerCorrect', 'composerReply', 'composerStar', 'composerVoice'],
} as const satisfies Record<string, readonly string[]>

export type TipSlot = keyof typeof TIP_SLOTS
/** A union, so a typo is a compile error — and derived, so a slot cannot drift. */
export type TipId = (typeof TIP_SLOTS)[TipSlot][number]
export const TIP_IDS: readonly TipId[] = Object.values(TIP_SLOTS).flat()
export const TIP_SLOT_NAMES = Object.keys(TIP_SLOTS) as TipSlot[]

/** What is written to the device: dismissed ids, plus the global switch. */
export interface TipState {
  /**
   * `false` means the person turned tips off in Settings. **Not** optional and
   * not defaulted here: an absent stored value has to become `true` at the
   * boundary, and `readBoolFlag` cannot tell "never set" from "set to off" —
   * which is why the whole thing is one JSON blob rather than a bool flag.
   */
  enabled: boolean
  dismissed: Partial<Record<TipId, true>>
  /**
   * How far through each slot's list the reader has got.
   *
   * Persisted, and that is the point: a counter that reset each launch would
   * show the same first tip on every cold start, which is the complaint this
   * whole thing answers.
   */
  seen: Partial<Record<TipSlot, number>>
}

export const DEFAULT_TIP_STATE: TipState = { enabled: true, dismissed: {}, seen: {} }

/**
 * Whatever came back from storage, made safe.
 *
 * `readJsonFlag` returns `unknown` and swallows its own failures, so a value
 * written by an older build — or a truncated one — must read as the default
 * rather than crash a screen that only wanted to show a hint.
 */
export function parseTipState(raw: unknown): TipState {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_TIP_STATE
  const record = raw as Record<string, unknown>
  const dismissedRaw = record.dismissed
  const dismissed: Partial<Record<TipId, true>> = {}
  if (typeof dismissedRaw === 'object' && dismissedRaw !== null) {
    for (const id of TIP_IDS) {
      if ((dismissedRaw as Record<string, unknown>)[id] === true) dismissed[id] = true
    }
  }
  const seenRaw = record.seen
  const seen: Partial<Record<TipSlot, number>> = {}
  if (typeof seenRaw === 'object' && seenRaw !== null) {
    for (const slot of TIP_SLOT_NAMES) {
      const value = (seenRaw as Record<string, unknown>)[slot]
      // A cursor is only ever an index into a list that may since have been
      // reordered or shortened, so anything not a whole number in range is
      // simply the start.
      if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
        seen[slot] = value % TIP_SLOTS[slot].length
      }
    }
  }

  return {
    // Anything that is not an explicit `false` is on: tips default to shown,
    // and a corrupt value must not silently turn a feature off.
    enabled: record.enabled !== false,
    dismissed,
    seen,
  }
}

/**
 * The tip this slot should show now, or `null` when there is nothing left.
 *
 * Starts at the slot's cursor and walks forward past anything dismissed, so a
 * reader who has sent three away still gets the fourth rather than a gap.
 */
export function pickTip(state: TipState, slot: TipSlot): TipId | null {
  if (!state.enabled) return null
  const pool = TIP_SLOTS[slot]
  const start = state.seen[slot] ?? 0
  for (let offset = 0; offset < pool.length; offset++) {
    const id = pool[(start + offset) % pool.length]
    if (id !== undefined && state.dismissed[id] !== true) return id
  }
  return null
}

/** Moves a slot on, so the next visit teaches the next thing. */
export function advanceSlot(state: TipState, slot: TipSlot): TipState {
  const pool = TIP_SLOTS[slot]
  return {
    ...state,
    seen: { ...state.seen, [slot]: ((state.seen[slot] ?? 0) + 1) % pool.length },
  }
}

export function shouldShowTip(state: TipState, id: TipId): boolean {
  return state.enabled && state.dismissed[id] !== true
}

export function dismissTip(state: TipState, id: TipId): TipState {
  return { ...state, dismissed: { ...state.dismissed, [id]: true } }
}

/**
 * Turning tips back on clears the dismissals too.
 *
 * Otherwise the switch does nothing for the person most likely to use it —
 * someone who turned tips off after dismissing several, and turning them on
 * again would show only the ones they never reached.
 */
export function setTipsEnabled(state: TipState, enabled: boolean): TipState {
  // The cursors go with the dismissals: turning tips back on means starting
  // over, not resuming four-fifths of the way through a list.
  return enabled ? { enabled: true, dismissed: {}, seen: {} } : { ...state, enabled: false }
}
