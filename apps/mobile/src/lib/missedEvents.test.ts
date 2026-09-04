import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { invalidateMissedEvents, resumedFromBackground } from './missedEvents'

describe('resumedFromBackground', () => {
  it('is the phone coming back from the background', () => {
    expect(resumedFromBackground('background', 'active')).toBe(true)
  })

  /** The notification shade or Face ID going away; the socket never dropped. */
  it('is not the shade going away', () => {
    expect(resumedFromBackground('inactive', 'active')).toBe(false)
  })

  it('is not leaving, and not the first state of a launch', () => {
    expect(resumedFromBackground('active', 'background')).toBe(false)
    expect(resumedFromBackground('active', 'inactive')).toBe(false)
    expect(resumedFromBackground('unknown', 'active')).toBe(false)
    expect(resumedFromBackground('active', 'active')).toBe(false)
  })
})

describe('invalidateMissedEvents', () => {
  /**
   * Every list tab, the unread total the tab badge and the app icon read, and
   * every cache under a thread including a jump window — and nothing else.
   * `me` is the control: a resume is not a reason to ask who the user is
   * again.
   */
  it('marks every chat list and thread cache stale, and nothing else', async () => {
    const client = new QueryClient()
    const stale = [
      ['conversations', 'all'],
      ['conversations', 'unreplied'],
      // The tab badge and the app icon read this one, and it is the whole
      // reason the three counts used to disagree after a resume. It looked
      // covered here for a while by `['conversations', 'unread']` — which is
      // not a key anything writes: the filters are all/unreplied/archived.
      ['unread'],
      ['messages', 'c1'],
      ['messages', 'c1', 'around', 'm9'],
    ]
    for (const key of [...stale, ['me']]) client.setQueryData(key, {})

    await invalidateMissedEvents(client)

    for (const key of stale) {
      expect(client.getQueryState(key)?.isInvalidated, key.join('/')).toBe(true)
    }
    expect(client.getQueryState(['me'])?.isInvalidated).toBe(false)
  })
})
