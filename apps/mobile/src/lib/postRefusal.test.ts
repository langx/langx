import { describe, expect, it } from 'vitest'
import { isStaleCursor, postRefusalKey, replyRefusalKey } from './postRefusal'

const refused = (reason?: string) => ({
  code: 'VALIDATION_FAILED',
  ...(reason ? { reason } : {}),
})

describe('isStaleCursor', () => {
  it('knows a cursor from another ranking', () => {
    expect(isStaleCursor(refused('stale_cursor'))).toBe(true)
  })

  it('is not fooled by any other refusal', () => {
    expect(isStaleCursor(refused())).toBe(false)
    expect(isStaleCursor(refused('not_asked'))).toBe(false)
    expect(isStaleCursor({ code: 'NOT_FOUND', reason: 'stale_cursor' })).toBe(false)
    expect(isStaleCursor(new Error('offline'))).toBe(false)
    expect(isStaleCursor(null)).toBe(false)
  })
})

describe('postRefusalKey', () => {
  it('words every reason a post can be refused for', () => {
    expect(postRefusalKey(refused('ask_needs_words'))).toBe('feed.needsText')
    expect(postRefusalKey(refused('moment_needs_content'))).toBe('feed.needsSomething')
    expect(postRefusalKey(refused('ask_needs_learning_language'))).toBe('feed.askNeedsLearning')
    expect(postRefusalKey(refused('language_not_yours'))).toBe('feed.languageNotYours')
    expect(postRefusalKey(refused('not_asked'))).toBe('feed.notAsking')
  })

  it('falls back to the generic sentence when there is no reason to read', () => {
    // An API that refuses `asks` outright sends no reason, and nothing the
    // writer changes will get it through.
    expect(postRefusalKey(refused())).toBe('feed.postFailed')
    expect(postRefusalKey(refused('something_new'))).toBe('feed.postFailed')
  })

  it('tells the daily post cap apart from the media quota', () => {
    expect(postRefusalKey({ code: 'QUOTA_EXCEEDED', limit: 'postsPer24h' })).toBe('feed.postLimit')
    expect(postRefusalKey({ code: 'QUOTA_EXCEEDED', limit: 'mediaPer24h' })).toBeNull()
  })

  it('leaves everything else to the caller', () => {
    expect(postRefusalKey({ code: 'MEDIA_TOO_LARGE' })).toBeNull()
    expect(postRefusalKey(new TypeError('Network request failed'))).toBeNull()
  })
})

describe('replyRefusalKey', () => {
  it('keeps "already corrected" for the one refusal without a reason', () => {
    expect(replyRefusalKey(refused(), 'feed.alreadyCorrected')).toEqual({
      key: 'feed.alreadyCorrected',
      duplicate: true,
    })
  })

  it('says the post asks for something else when it does', () => {
    expect(replyRefusalKey(refused('not_asked'), 'feed.alreadyCorrected')).toEqual({
      key: 'feed.notAsking',
      duplicate: false,
    })
  })

  it('does not claim a network failure was a refusal', () => {
    expect(replyRefusalKey(new Error('offline'), 'feed.alreadyCorrected')).toBeNull()
    expect(replyRefusalKey({ code: 'NOT_FOUND' }, 'feed.alreadyCorrected')).toBeNull()
  })
})
