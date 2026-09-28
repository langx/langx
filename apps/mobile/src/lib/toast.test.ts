import { beforeEach, describe, expect, it } from 'vitest'
import { SPLASH_TIMING } from './splashTiming'
import {
  ACTION_TOAST_DURATION_MS,
  TOAST_DURATION_MS,
  dismissToast,
  msUntilToastsMayShow,
  toastEdge,
  resetToastsForTest,
  showToast,
  subscribeToToasts,
  type Toast,
} from './toast'

beforeEach(() => resetToastsForTest())

/** Stands in for `ToastHost`: records what it is asked to draw. */
function mountHost(): { shown: () => Toast | null } {
  let current: Toast | null = null
  subscribeToToasts((toast) => {
    current = toast
  })
  return { shown: () => current }
}

describe('showToast', () => {
  it('shows the message it was given', () => {
    const host = mountHost()
    showToast('Signed out — your session has ended.')
    expect(host.shown()?.message).toBe('Signed out — your session has ended.')
    expect(host.shown()?.durationMs).toBe(TOAST_DURATION_MS)
  })

  it('shows nothing until something is queued', () => {
    const host = mountHost()
    expect(host.shown()).toBeNull()
  })

  it('shows nothing again once dismissed', () => {
    const host = mountHost()
    showToast('Saved')
    dismissToast(host.shown()!.id)
    expect(host.shown()).toBeNull()
  })

  /**
   * The reason this queues instead of replacing, which is also why `alert.ts`
   * does: two things finishing at once must not leave one of them unsaid.
   */
  it('queues a second message behind the first', () => {
    const host = mountHost()
    showToast('First')
    showToast('Second')
    expect(host.shown()?.message).toBe('First')

    dismissToast(host.shown()!.id)
    expect(host.shown()?.message).toBe('Second')

    dismissToast(host.shown()!.id)
    expect(host.shown()).toBeNull()
  })

  /**
   * `ToastHost` sets a timer per toast and clears it on unmount, but a timer
   * that fires late — after the banner was tapped — must not take the next
   * message down with it.
   */
  it('ignores a dismissal for a toast that is already gone', () => {
    const host = mountHost()
    showToast('First')
    const staleId = host.shown()!.id
    dismissToast(staleId)
    showToast('Second')

    dismissToast(staleId)
    expect(host.shown()?.message).toBe('Second')
  })

  it('accepts a duration of its own', () => {
    const host = mountHost()
    showToast('Briefly', 500)
    expect(host.shown()?.durationMs).toBe(500)
  })

  it('stops publishing once unsubscribed', () => {
    let current: Toast | null = null
    const unsubscribe = subscribeToToasts((toast) => {
      current = toast
    })
    unsubscribe()
    showToast('Nobody is listening')
    expect(current).toBeNull()
  })
})

describe('when and where a toast shows', () => {
  it('waits out the opening: its longest hold and its whole exit', () => {
    expect(msUntilToastsMayShow(SPLASH_TIMING)).toBe(
      SPLASH_TIMING.MIN_VISIBLE_MS +
        SPLASH_TIMING.EXIT_GROUND_DELAY_MS +
        SPLASH_TIMING.EXIT_GROUND_MS,
    )
  })

  it('gives a toast with something to press longer than one without', () => {
    expect(ACTION_TOAST_DURATION_MS).toBeGreaterThanOrEqual(TOAST_DURATION_MS * 2)
  })

  it('sits at the top on the signed-out screens, whose bottom is their buttons', () => {
    expect(toastEdge(['(auth)', 'welcome'])).toBe('top')
    expect(toastEdge(['(auth)', 'sign-in'])).toBe('top')
  })

  it('sits above the tab bar everywhere else', () => {
    expect(toastEdge(['(app)', '(tabs)', 'discover'])).toBe('bottom')
    expect(toastEdge(['(onboarding)', 'languages'])).toBe('bottom')
    expect(toastEdge([])).toBe('bottom')
  })
})
