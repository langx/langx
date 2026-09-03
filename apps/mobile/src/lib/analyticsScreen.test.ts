import { describe, expect, it } from 'vitest'
import { screenNameFromSegments } from './analyticsScreen'

describe('screenNameFromSegments', () => {
  it('names the root by its file', () => {
    expect(screenNameFromSegments([])).toBe('index')
  })

  /**
   * The segments are the route template, so the name carries `[id]` and never
   * the conversation, post or handle behind it — that is why the pathname is
   * not used.
   */
  it('keeps the route template, so an identifier never appears', () => {
    expect(screenNameFromSegments(['(app)', 'chat', '[id]'])).toBe('(app)/chat/[id]')
    expect(screenNameFromSegments(['(app)', 'profile', '[handle]'])).toBe('(app)/profile/[handle]')
  })

  it('keeps the group, which is what tells the two intros apart', () => {
    expect(screenNameFromSegments(['(auth)', 'intro'])).toBe('(auth)/intro')
    expect(screenNameFromSegments(['(app)', 'intro'])).toBe('(app)/intro')
  })
})
