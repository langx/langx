import { PERIOD_TYPES } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { createTranslate } from '../i18n/runtime'
import {
  badgeShareText,
  isShareCancel,
  leaderboardShareText,
  postExcerpt,
  postShareText,
  profileShareText,
  SHARE_EXCERPT_LENGTH,
  streakShareText,
} from './shareText'

const t = createTranslate('en')

describe('postExcerpt', () => {
  it('leaves a short post alone, ellipsis and all', () => {
    expect(postExcerpt('Bonjour à tous!')).toBe('Bonjour à tous!')
    expect(postExcerpt('Bonjour à tous!')).not.toContain('…')
  })

  it('collapses the whitespace a multi-line post carries', () => {
    expect(postExcerpt('  one\n\ntwo   three ')).toBe('one two three')
  })

  it('cuts a long post at a word and never past the limit', () => {
    const body = Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ')
    const excerpt = postExcerpt(body)
    expect(excerpt.endsWith('…')).toBe(true)
    expect(excerpt.length).toBeLessThanOrEqual(SHARE_EXCERPT_LENGTH)
    expect(excerpt).toMatch(/word\d+…$/)
  })

  it('cuts mid-word rather than throwing away half the excerpt', () => {
    const excerpt = postExcerpt('a'.repeat(400))
    expect(excerpt.length).toBe(SHARE_EXCERPT_LENGTH)
    expect(excerpt.endsWith('…')).toBe(true)
  })
})

describe('the sentences', () => {
  it('put the link inside the message, for the platform with one field', () => {
    for (const content of [
      profileShareText(t, { name: 'Deniz', handle: 'deniz' }),
      postShareText(t, { id: 'abc', body: 'Hola', languageName: 'Spanish' }),
      streakShareText(t, { count: 12, handle: 'deniz' }),
      leaderboardShareText(t, { rank: 3, period: 'week', handle: 'deniz' }),
      badgeShareText(t, { label: '30 days', handle: 'deniz' }),
    ]) {
      expect(content.url).toBeDefined()
      expect(content.message).toContain(content.url)
    }
  })

  it('links a profile to the profile, not to an invite', () => {
    const { url } = profileShareText(t, { name: 'Deniz', handle: 'deniz' })
    expect(url).toBe('https://app2.langx.io/deniz')
  })

  it('links a post to the post', () => {
    const { url, message } = postShareText(t, { id: 'abc', body: 'Hola', languageName: 'Spanish' })
    expect(url).toBe('https://app2.langx.io/post/abc')
    expect(message).toContain('Hola')
    expect(message).toContain('Spanish')
  })

  /** A brag is the moment a friend is most likely to try the app. */
  it('sends every achievement out with the invite marker', () => {
    for (const { url } of [
      streakShareText(t, { count: 12, handle: 'deniz' }),
      leaderboardShareText(t, { rank: 3, period: 'all', handle: 'deniz' }),
      badgeShareText(t, { label: '30 days', handle: 'deniz' }),
    ]) {
      expect(url).toBe('https://app2.langx.io/deniz?invite=1')
    }
  })

  it('has a whole sentence for every leaderboard period', () => {
    for (const period of PERIOD_TYPES) {
      const { message } = leaderboardShareText(t, { rank: 7, period, handle: 'deniz' })
      expect(message).not.toContain('share.leaderboardMessage')
      expect(message).toContain('#7')
    }
  })

  it('pluralises the streak', () => {
    expect(streakShareText(t, { count: 1, handle: 'd' }).message).toContain('1-day')
    expect(streakShareText(t, { count: 30, handle: 'd' }).message).toContain('30-day')
  })

  /** `token-messaging-brief.md`: achievements, never balances. */
  it('never mentions tokens', () => {
    for (const { message } of [
      profileShareText(t, { name: 'Deniz', handle: 'deniz' }),
      postShareText(t, { id: 'abc', body: 'Hola', languageName: 'Spanish' }),
      streakShareText(t, { count: 12, handle: 'deniz' }),
      leaderboardShareText(t, { rank: 3, period: 'month', handle: 'deniz' }),
    ]) {
      expect(message).not.toMatch(/token/i)
    }
  })
})

describe('isShareCancel', () => {
  it('recognises the browser closing the sheet, and nothing else', () => {
    expect(isShareCancel({ name: 'AbortError' })).toBe(true)
    expect(isShareCancel(new Error('Share is not supported in this browser'))).toBe(false)
    expect(isShareCancel(null)).toBe(false)
    expect(isShareCancel('AbortError')).toBe(false)
  })
})
