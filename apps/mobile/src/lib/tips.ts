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

/** Every tip the app can show. A union, so a typo is a compile error. */
export const TIP_IDS = ['chatCorrect', 'chatSwipeReply', 'discoverFilters', 'feedAsk'] as const
export type TipId = (typeof TIP_IDS)[number]

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
}

export const DEFAULT_TIP_STATE: TipState = { enabled: true, dismissed: {} }

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
  return {
    // Anything that is not an explicit `false` is on: tips default to shown,
    // and a corrupt value must not silently turn a feature off.
    enabled: record.enabled !== false,
    dismissed,
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
  return enabled ? { enabled: true, dismissed: {} } : { ...state, enabled: false }
}
