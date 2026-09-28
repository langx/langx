import { describe, expect, it } from 'vitest'
import type { AlertRequest } from './alert'
import { NO_ALERT, alertDismissed, alertWanted, isAlertVisible } from './alertPresentation'

function request(id: number): AlertRequest<unknown> {
  return { id, title: `Request ${id}`, buttons: [{ label: 'OK', value: undefined }] }
}

describe('alertWanted', () => {
  it('presents a request when nothing is open', () => {
    const state = alertWanted(NO_ALERT, request(1), true)
    expect(state.drawn?.id).toBe(1)
    expect(isAlertVisible(state)).toBe(true)
  })

  it('swaps the content of an open sheet rather than closing it', () => {
    const open = alertWanted(NO_ALERT, request(1), true)
    const next = alertWanted(open, request(2), true)
    expect(next.drawn?.id).toBe(2)
    expect(isAlertVisible(next)).toBe(true)
  })

  it('keeps drawing the answered request while iOS slides it away', () => {
    const open = alertWanted(NO_ALERT, request(1), true)
    const closing = alertWanted(open, null, true)
    expect(closing.closing).toBe(true)
    expect(closing.drawn?.id).toBe(1)
    expect(isAlertVisible(closing)).toBe(false)
  })

  it('closes at once where there is no dismissal to wait for', () => {
    const open = alertWanted(NO_ALERT, request(1), false)
    expect(alertWanted(open, null, false)).toEqual(NO_ALERT)
  })

  /**
   * The bug: the attach menu closes, a GPS fix comes back inside the slide
   * out, and the location sheet was presented then — which iOS drops.
   */
  it('holds a request that arrives mid-dismissal until the dismissal ends', () => {
    const open = alertWanted(NO_ALERT, request(1), true)
    const closing = alertWanted(open, null, true)
    const waiting = alertWanted(closing, request(2), true)
    expect(isAlertVisible(waiting)).toBe(false)
    expect(waiting.drawn?.id).toBe(1)

    const shown = alertDismissed(waiting)
    expect(shown.drawn?.id).toBe(2)
    expect(isAlertVisible(shown)).toBe(true)
  })

  it('ends empty when nothing arrived during the dismissal', () => {
    const closing = alertWanted(alertWanted(NO_ALERT, request(1), true), null, true)
    expect(alertDismissed(closing)).toEqual(NO_ALERT)
  })
})

describe('alertDismissed', () => {
  it('ignores a late dismissal once the host has moved on', () => {
    const open = alertWanted(NO_ALERT, request(3), true)
    expect(alertDismissed(open)).toBe(open)
  })
})
