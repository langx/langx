import { describe, expect, it } from 'vitest'
import { notificationRoute } from './notificationRoute'

describe('notificationRoute', () => {
  it('opens the conversation a message notification is about', () => {
    expect(notificationRoute({ kind: 'message', conversationId: 'abc123' })).toBe('/chat/abc123')
  })

  it('falls back to the list when the conversation id is missing', () => {
    // Better than an empty chat screen with no way back to anything.
    expect(notificationRoute({ kind: 'message' })).toBe('/chats')
    expect(notificationRoute({ kind: 'message', conversationId: '' })).toBe('/chats')
  })

  it('sends the streak nudge to the people already being talked to', () => {
    expect(notificationRoute({ kind: 'streakReminder' })).toBe('/chats')
  })

  it('routes nowhere for a payload it does not recognise', () => {
    // This runs on a launch path against whatever the server sent, including
    // a kind added after this build shipped. Throwing there would mean the app
    // fails to open at all, so an unknown payload has to be a no-op.
    expect(notificationRoute({ kind: 'somethingNew' })).toBeNull()
    expect(notificationRoute({})).toBeNull()
    expect(notificationRoute(null)).toBeNull()
    expect(notificationRoute(undefined)).toBeNull()
    expect(notificationRoute('message')).toBeNull()
    expect(notificationRoute({ kind: 42 })).toBeNull()
  })
  it('lands a profile-visit round-up on the viewers screen', () => {
    // The push carried a count and no names; this screen is where the
    // difference between the free count and the Pro list is drawn.
    expect(notificationRoute({ kind: 'profileVisits' })).toBe('/viewers')
  })
})
