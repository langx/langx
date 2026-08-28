import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  askAlert,
  chooseAlert,
  confirmAlert,
  dismissValue,
  resetAlertsForTest,
  resolveAlert,
  showAlert,
  subscribeToAlerts,
  type AlertRequest,
} from './alert'

beforeEach(() => resetAlertsForTest())

/** Stands in for `AlertHost`: records what it is asked to draw. */
function mountHost(): { shown: () => AlertRequest<unknown> | null } {
  let current: AlertRequest<unknown> | null = null
  subscribeToAlerts((request) => {
    current = request
  })
  return { shown: () => current }
}

describe('askAlert', () => {
  it('resolves with the pressed button’s value', async () => {
    const host = mountHost()
    const answer = askAlert('Title', 'Body', [
      { label: 'No', value: 'no' },
      { label: 'Yes', value: 'yes' },
    ])
    resolveAlert(host.shown()!.id, 'yes')
    await expect(answer).resolves.toBe('yes')
  })

  it('shows nothing once every request is answered', async () => {
    const host = mountHost()
    const answer = showAlert('Done')
    resolveAlert(host.shown()!.id, undefined)
    await answer
    expect(host.shown()).toBeNull()
  })

  /**
   * The reason this queues instead of replacing: an upload failing while a
   * quota warning is still up must not swallow one of the two messages.
   */
  it('queues a second request behind the first', async () => {
    const host = mountHost()
    const first = askAlert('First', undefined, [{ label: 'OK', value: 1 }])
    const second = askAlert('Second', undefined, [{ label: 'OK', value: 2 }])
    expect(host.shown()?.title).toBe('First')

    resolveAlert(host.shown()!.id, 1)
    await expect(first).resolves.toBe(1)
    expect(host.shown()?.title).toBe('Second')

    resolveAlert(host.shown()!.id, 2)
    await expect(second).resolves.toBe(2)
  })

  it('ignores an id it has already resolved', async () => {
    const host = mountHost()
    const answer = showAlert('Once')
    const { id } = host.shown()!
    resolveAlert(id, undefined)
    await answer
    expect(() => resolveAlert(id, undefined)).not.toThrow()
  })
})

describe('confirmAlert', () => {
  it('is false until the confirm button is pressed', async () => {
    const host = mountHost()
    const answer = confirmAlert({ title: 'Delete', confirmLabel: 'Delete', destructive: true })
    const request = host.shown()!
    expect(request.buttons.map((b) => b.label)).toEqual(['Cancel', 'Delete'])
    expect(request.buttons[1]?.style).toBe('destructive')
    resolveAlert(request.id, true)
    await expect(answer).resolves.toBe(true)
  })

  /**
   * Dismissing has to mean "no". This is the guard on the account-deletion
   * dialog: tapping the backdrop must never be read as consent.
   */
  it('treats a dismissal as a refusal', async () => {
    const host = mountHost()
    const answer = confirmAlert({ title: 'Delete', confirmLabel: 'Delete' })
    const request = host.shown()!
    resolveAlert(request.id, dismissValue(request.buttons))
    await expect(answer).resolves.toBe(false)
  })
})

describe('chooseAlert', () => {
  it('resolves with the chosen value', async () => {
    const host = mountHost()
    const answer = chooseAlert('Report', 'Why?', [
      { label: 'Spam', value: 'spam' },
      { label: 'Harassment', value: 'harassment' },
    ])
    expect(host.shown()?.buttons.map((b) => b.label)).toEqual(['Spam', 'Harassment', 'Cancel'])
    resolveAlert(host.shown()!.id, 'harassment')
    await expect(answer).resolves.toBe('harassment')
  })

  it('resolves with null when dismissed, so nothing is reported by accident', async () => {
    const host = mountHost()
    const answer = chooseAlert('Report', undefined, [{ label: 'Spam', value: 'spam' }])
    const request = host.shown()!
    resolveAlert(request.id, dismissValue(request.buttons))
    await expect(answer).resolves.toBeNull()
  })
})

describe('dismissValue', () => {
  it('is the cancel button’s value', () => {
    expect(dismissValue([{ label: 'Cancel', value: false, style: 'cancel' }])).toBe(false)
  })

  it('is undefined when there is nothing to cancel', () => {
    expect(dismissValue([{ label: 'OK', value: undefined }])).toBeUndefined()
  })
})

describe('subscribeToAlerts', () => {
  it('hands a pending request to a host that mounts late', () => {
    void showAlert('Already waiting')
    const host = mountHost()
    expect(host.shown()?.title).toBe('Already waiting')
  })

  it('stops publishing after unsubscribe', () => {
    const seen = vi.fn()
    const unsubscribe = subscribeToAlerts(seen)
    unsubscribe()
    seen.mockClear()
    void showAlert('Nobody is listening')
    expect(seen).not.toHaveBeenCalled()
  })
})
