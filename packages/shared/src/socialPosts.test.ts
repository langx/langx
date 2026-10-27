import { describe, expect, it } from 'vitest'
import { DEFAULT_APP_CONFIG } from './appConfig'
import { captionWithHashtags, SOCIAL_AUTOPOST_RULES } from './socialPosts'

describe('social auto-posting', () => {
  it('ships switched off: posting starts when an operator turns it on, not on deploy', () => {
    expect(DEFAULT_APP_CONFIG.flags.socialAutopost).toBe(false)
  })

  it('has one wait before each retry and none after the last attempt', () => {
    expect(SOCIAL_AUTOPOST_RULES.backoffMinutes).toHaveLength(SOCIAL_AUTOPOST_RULES.maxAttempts - 1)
  })

  it('sends the words, a blank line, then the hashtags, and nothing empty', () => {
    expect(captionWithHashtags({ caption: 'Day 1.', hashtags: ['#a', '#b'] })).toBe(
      'Day 1.\n\n#a #b',
    )
    expect(captionWithHashtags({ caption: ' Day 1. ', hashtags: [] })).toBe('Day 1.')
    expect(captionWithHashtags({ hashtags: ['#a'] })).toBe('#a')
  })
})
