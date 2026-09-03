import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  dismissMessageBanner,
  previewOf,
  resetMessageBannersForTest,
  shouldShowIncomingBanner,
  showMessageBanner,
  subscribeToMessageBanner,
} from './inAppNotifications'

const ME = 'me'
const THEM = 'them'

function incoming(overrides: Record<string, unknown> = {}) {
  return {
    message: { senderId: THEM, conversationId: 'c1', type: 'text', ...overrides },
    meId: ME,
    activeConversationId: null,
    appActive: true,
    messagesPushAllowed: true,
  }
}

describe('shouldShowIncomingBanner', () => {
  it('shows one for somebody else’s message in a thread nobody is reading', () => {
    expect(shouldShowIncomingBanner(incoming())).toBe('banner')
  })

  it('says nothing about your own message arriving back', () => {
    expect(
      shouldShowIncomingBanner({ ...incoming(), message: { ...incoming().message, senderId: ME } }),
    ).toBe('ignore')
  })

  /** The cache has not answered yet, or this is a guest. */
  it('says nothing when it does not know who you are', () => {
    expect(shouldShowIncomingBanner({ ...incoming(), meId: undefined })).toBe('ignore')
  })

  it('says nothing about a withdrawn or hidden message', () => {
    expect(shouldShowIncomingBanner(incoming({ deleted: true }))).toBe('ignore')
    expect(shouldShowIncomingBanner(incoming({ hidden: true }))).toBe('ignore')
  })

  /**
   * Looking straight at the thread. Marking it read here is what the chat
   * screen cannot do for itself: it posts on focus, and it is already focused.
   */
  it('marks read instead of interrupting when the thread is open', () => {
    expect(shouldShowIncomingBanner({ ...incoming(), activeConversationId: 'c1' })).toBe('markRead')
  })

  /**
   * Android keeps the JS thread alive in the background, so the chat screen
   * can still be the focused route with nobody looking at it. Clearing an
   * unread badge there is clearing it for a message never seen.
   */
  it('does not mark read while the app is in the background', () => {
    expect(
      shouldShowIncomingBanner({ ...incoming(), activeConversationId: 'c1', appActive: false }),
    ).toBe('banner')
  })

  it('shows one for a different thread even while a chat is open', () => {
    expect(shouldShowIncomingBanner({ ...incoming(), activeConversationId: 'other' })).toBe(
      'banner',
    )
  })

  /**
   * The banner is the foreground face of the push channel: one switch has to
   * silence every unsolicited "somebody wrote", wherever it is drawn.
   */
  it('obeys the messages push switch', () => {
    expect(shouldShowIncomingBanner({ ...incoming(), messagesPushAllowed: false })).toBe('ignore')
  })

  /** But a message in the open thread is still read, switch or no switch. */
  it('still marks read for somebody who turned notifications off', () => {
    expect(
      shouldShowIncomingBanner({
        ...incoming(),
        activeConversationId: 'c1',
        messagesPushAllowed: false,
      }),
    ).toBe('markRead')
  })
})

describe('the banner queue', () => {
  afterEach(() => {
    resetMessageBannersForTest()
  })

  it('tells a subscriber what is showing, and what replaced it', () => {
    const seen = vi.fn()
    subscribeToMessageBanner(seen)
    showMessageBanner({ conversationId: 'c1', senderId: THEM, preview: 'text', body: 'hi' })

    expect(seen).toHaveBeenLastCalledWith(expect.objectContaining({ conversationId: 'c1' }))
  })

  /**
   * Replaces rather than queues, unlike `toast.ts`. A toast reports an outcome
   * and has to be seen; this points at a chat list that already shows every
   * one of these. Three quick messages must not hold the screen for fifteen
   * seconds.
   */
  it('replaces rather than queueing behind', () => {
    const seen = vi.fn()
    subscribeToMessageBanner(seen)
    showMessageBanner({ conversationId: 'c1', senderId: THEM, preview: 'text', body: 'one' })
    showMessageBanner({ conversationId: 'c2', senderId: THEM, preview: 'text', body: 'two' })

    expect(seen).toHaveBeenLastCalledWith(expect.objectContaining({ conversationId: 'c2' }))
  })

  it('ignores a dismissal for a banner already replaced', () => {
    const seen = vi.fn()
    subscribeToMessageBanner(seen)
    showMessageBanner({ conversationId: 'c1', senderId: THEM, preview: 'text', body: 'one' })
    const stale = seen.mock.calls.at(-1)?.[0] as { id: number }
    showMessageBanner({ conversationId: 'c2', senderId: THEM, preview: 'text', body: 'two' })

    dismissMessageBanner(stale.id)
    expect(seen).toHaveBeenLastCalledWith(expect.objectContaining({ conversationId: 'c2' }))
  })

  it('clears on its own dismissal', () => {
    const seen = vi.fn()
    subscribeToMessageBanner(seen)
    showMessageBanner({ conversationId: 'c1', senderId: THEM, preview: 'text', body: 'one' })
    const shown = seen.mock.calls.at(-1)?.[0] as { id: number }

    dismissMessageBanner(shown.id)
    expect(seen).toHaveBeenLastCalledWith(null)
  })

  it('stops telling an unsubscribed listener anything', () => {
    const seen = vi.fn()
    const unsubscribe = subscribeToMessageBanner(seen)
    unsubscribe()
    showMessageBanner({ conversationId: 'c1', senderId: THEM, preview: 'text', body: 'one' })

    expect(seen).toHaveBeenCalledTimes(1) // the initial null, and nothing since
  })
})

describe('previewOf', () => {
  it('keeps the three kinds that have no text to show', () => {
    expect(previewOf('image')).toBe('image')
    expect(previewOf('audio')).toBe('audio')
    expect(previewOf('correction')).toBe('correction')
  })

  /** A kind added to the server later must not render as a dotted path. */
  it('falls back to text for anything else', () => {
    expect(previewOf('text')).toBe('text')
    expect(previewOf('somethingNew')).toBe('text')
  })
})
