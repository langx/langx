import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MessageMenuRequest } from './messageMenu'
import {
  openMessageMenu,
  resetMessageMenuForTest,
  resolveMessageMenu,
  subscribeToMessageMenu,
} from './messageMenu'

const COPY = [{ id: 'copy' as const, label: 'Copy', icon: 'copy-outline' }]

afterEach(() => {
  resetMessageMenuForTest()
})

describe('messageMenu', () => {
  it('publishes the request to a subscriber and resolves with the pick', async () => {
    const seen: (MessageMenuRequest | null)[] = []
    subscribeToMessageMenu((r) => seen.push(r))

    const picked = openMessageMenu('hello', COPY)
    const request = seen.at(-1)
    expect(request?.preview).toBe('hello')

    resolveMessageMenu(request!.id, 'copy')
    await expect(picked).resolves.toBe('copy')
    expect(seen.at(-1)).toBeNull()
  })

  it('resolves null when dismissed', async () => {
    let request: MessageMenuRequest | null = null
    subscribeToMessageMenu((r) => (request = r))
    const picked = openMessageMenu('hello', COPY)
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

    const first = openMessageMenu('one', COPY)
    const second = openMessageMenu('two', COPY)
    await expect(first).resolves.toBeNull()

    expect(request!.preview).toBe('two')
    resolveMessageMenu(request!.id, 'copy')
    await expect(second).resolves.toBe('copy')
  })

  it('ignores a resolve for a menu that is no longer open', async () => {
    let request: MessageMenuRequest | null = null
    subscribeToMessageMenu((r) => (request = r))
    const picked = openMessageMenu('hello', COPY)
    const staleId = request!.id

    resolveMessageMenu(staleId, 'copy')
    await expect(picked).resolves.toBe('copy')

    // A late press on a menu already gone must not throw or reopen anything.
    const onChange = vi.fn()
    subscribeToMessageMenu(onChange)
    onChange.mockClear()
    resolveMessageMenu(staleId, 'report')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('unsubscribes cleanly', () => {
    const listener = vi.fn()
    const off = subscribeToMessageMenu(listener)
    off()
    listener.mockClear()
    void openMessageMenu('hello', COPY)
    expect(listener).not.toHaveBeenCalled()
  })
})
