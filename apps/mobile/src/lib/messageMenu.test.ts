import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MessageMenuRequest } from './messageMenu'
import { STAGGER_TIGHT } from './theme/motionValues'
import {
  MENU_MOTION,
  emojiDelay,
  menuOrigin,
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

describe('emojiDelay', () => {
  it('staggers the strip one emoji at a time', () => {
    expect(emojiDelay(0)).toBe(0)
    expect(emojiDelay(1)).toBe(STAGGER_TIGHT)
    expect(emojiDelay(3)).toBe(3 * STAGGER_TIGHT)
  })

  it('caps the wait, so a long strip is never still arriving', () => {
    expect(emojiDelay(40)).toBe(MENU_MOTION.emojiCap)
    expect(emojiDelay(40) + MENU_MOTION.emoji).toBeLessThanOrEqual(400)
  })
})

describe('menuOrigin', () => {
  it('grows the menu from the edge that touches the bubble', () => {
    expect(menuOrigin('below', 'menu', true)).toBe('right top')
    expect(menuOrigin('above', 'menu', false)).toBe('left bottom')
  })

  it('grows the strip from the opposite edge, on the same side', () => {
    expect(menuOrigin('below', 'strip', true)).toBe('right bottom')
    expect(menuOrigin('above', 'strip', false)).toBe('left top')
  })
})
