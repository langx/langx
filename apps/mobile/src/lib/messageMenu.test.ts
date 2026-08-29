import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MessageMenuRequest } from './messageMenu'
import {
  openMessageMenu,
  resetMessageMenuForTest,
  resolveMessageMenu,
  subscribeToMessageMenu,
} from './messageMenu'

const COPY = [
  { id: 'copy' as const, label: 'Copy', icon: 'copy-outline', page: 'primary' as const },
]

afterEach(() => {
  resetMessageMenuForTest()
})

describe('messageMenu', () => {
  it('publishes the request to a subscriber and resolves with the pick', async () => {
    const seen: (MessageMenuRequest | null)[] = []
    subscribeToMessageMenu((r) => seen.push(r))

    const picked = openMessageMenu({ mine: false, preview: 'hello', actions: COPY })
    const request = seen.at(-1)
    expect(request?.preview).toBe('hello')

    resolveMessageMenu(request!.id, { kind: 'action', id: 'copy' })
    await expect(picked).resolves.toEqual({ kind: 'action', id: 'copy' })
    expect(seen.at(-1)).toBeNull()
  })

  it('resolves null when dismissed', async () => {
    let request: MessageMenuRequest | null = null
    subscribeToMessageMenu((r) => (request = r))
    const picked = openMessageMenu({ mine: false, preview: 'hello', actions: COPY })
    resolveMessageMenu(request!.id, null)
    await expect(picked).resolves.toBeNull()
  })

  /**
   * Unlike alerts these do not queue: a menu belongs to one message and one
   * gesture, so a second one means the user moved on from the first.
   */
  it('dismisses an open menu when another is opened', async () => {
    let request: MessageMenuRequest | null = null
    subscribeToMessageMenu((r) => (request = r))

    const first = openMessageMenu({ mine: false, preview: 'one', actions: COPY })
    const second = openMessageMenu({ mine: false, preview: 'two', actions: COPY })
    await expect(first).resolves.toBeNull()

    expect(request!.preview).toBe('two')
    resolveMessageMenu(request!.id, { kind: 'action', id: 'copy' })
    await expect(second).resolves.toEqual({ kind: 'action', id: 'copy' })
  })

  it('ignores a resolve for a menu that is no longer open', async () => {
    let request: MessageMenuRequest | null = null
    subscribeToMessageMenu((r) => (request = r))
    const picked = openMessageMenu({ mine: false, preview: 'hello', actions: COPY })
    const staleId = request!.id

    resolveMessageMenu(staleId, { kind: 'action', id: 'copy' })
    await expect(picked).resolves.toEqual({ kind: 'action', id: 'copy' })

    // A late press on a menu already gone must not throw or reopen anything.
    const onChange = vi.fn()
    subscribeToMessageMenu(onChange)
    onChange.mockClear()
    resolveMessageMenu(staleId, { kind: 'action', id: 'report' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('unsubscribes cleanly', () => {
    const listener = vi.fn()
    const off = subscribeToMessageMenu(listener)
    off()
    listener.mockClear()
    void openMessageMenu({ mine: false, preview: 'hello', actions: COPY })
    expect(listener).not.toHaveBeenCalled()
  })
})
