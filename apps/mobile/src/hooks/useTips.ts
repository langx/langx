import { useEffect, useState } from 'react'
import { FLAG_KEYS, readJsonFlag, writeJsonFlag } from '../lib/localFlags'
import {
  DEFAULT_TIP_STATE,
  advanceSlot,
  dismissTip as dismissIn,
  parseTipState,
  pickTip,
  setTipsEnabled as setEnabledIn,
  shouldShowTip,
  type TipId,
  type TipSlot,
  type TipState,
} from '../lib/tips'

/**
 * The stored tip state, shared by every screen that shows one.
 *
 * A module-level store rather than a context, following `useOnboardingDraft`:
 * a tip dismissed on the chat screen has to be gone on the feed without a
 * provider wrapping both, and the state has to survive a screen unmounting.
 *
 * Read once and hydrated, like `ThemeProvider` and `I18nProvider` do with their
 * preferences — the common case has no flash at all, and the uncommon one shows
 * a tip for a moment rather than blocking the screen on a storage round-trip.
 */
let state: TipState = DEFAULT_TIP_STATE
let hydrated = false
let settled = false
const listeners = new Set<() => void>()

function publish(next: TipState): void {
  state = next
  for (const listener of listeners) listener()
  // Not awaited: losing a dismissal to a slow write means seeing one tip twice,
  // which is not worth holding the tap on.
  void writeJsonFlag(FLAG_KEYS.tips, next)
}

async function hydrate(): Promise<void> {
  if (hydrated) return
  hydrated = true
  const stored = await readJsonFlag<unknown>(FLAG_KEYS.tips)
  const parsed = parseTipState(stored)
  state = parsed
  settled = true
  for (const listener of listeners) listener()
}

export function useTips() {
  const [, force] = useState(0)

  useEffect(() => {
    const listener = () => force((n) => n + 1)
    listeners.add(listener)
    void hydrate()
    return () => {
      listeners.delete(listener)
    }
  }, [])

  return {
    enabled: state.enabled,
    /**
     * Whether the stored state has actually been read yet. A slot must not
     * choose before it has, or it picks the first tip in the list — including
     * one the reader dismissed months ago.
     */
    settled,
    isVisible: (id: TipId) => shouldShowTip(state, id),
    pick: (slot: TipSlot) => pickTip(state, slot),
    advance: (slot: TipSlot) => publish(advanceSlot(state, slot)),
    dismiss: (id: TipId) => publish(dismissIn(state, id)),
    setEnabled: (enabled: boolean) => publish(setEnabledIn(state, enabled)),
  }
}
