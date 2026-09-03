import { describe, expect, it } from 'vitest'
import { presentationFor } from './foregroundPush'

describe('what to do with a push that arrives while the app is open', () => {
  it('hands a message to the in-app banner', () => {
    expect(presentationFor({ kind: 'message', conversationId: 'c1' }, true)).toBe('suppress')
  })

  it('lets the OS draw it once the app is in the background', () => {
    expect(presentationFor({ kind: 'message', conversationId: 'c1' }, false)).toBe('os')
  })

  /**
   * These arrive once a day, have no in-app equivalent, and are the sort of
   * thing somebody swipes away and looks for again in the shade.
   */
  it('leaves the once-a-day kinds to the OS even in the foreground', () => {
    for (const kind of ['streakReminder', 'badgeEarned', 'profileVisits']) {
      expect(presentationFor({ kind }, true), kind).toBe('os')
    }
  })

  /** An unrecognised payload must still be shown, not swallowed. */
  it('shows anything it does not recognise', () => {
    expect(presentationFor({ kind: 'somethingNew' }, true)).toBe('os')
    expect(presentationFor({}, true)).toBe('os')
    expect(presentationFor(null, true)).toBe('os')
    expect(presentationFor(undefined, true)).toBe('os')
    expect(presentationFor('message', true)).toBe('os')
  })
})
