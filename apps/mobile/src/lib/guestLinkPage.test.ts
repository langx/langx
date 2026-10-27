import { describe, expect, it } from 'vitest'
import { GUEST_LINK_PAGES, guestLinkPage } from './guestLinkPage'

describe('GUEST_LINK_PAGES', () => {
  // Plan #2067, decision 14: these four and nothing else. A page added here
  // changes where a guest's link lands, so the list is pinned on purpose.
  it('is the four public product pages', () => {
    expect(Object.values(GUEST_LINK_PAGES).sort()).toEqual([
      '/(app)/copilot',
      '/(app)/token',
      '/(app)/transparency',
      '/(app)/venus',
    ])
  })
})

describe('guestLinkPage', () => {
  it.each([
    ['http://localhost:8081/token', '/(app)/token'],
    ['https://app.langx.io/transparency', '/(app)/transparency'],
    ['https://app.langx.io/venus/', '/(app)/venus'],
    ['https://app.langx.io/copilot?utm_source=site#top', '/(app)/copilot'],
    ['langx://copilot', '/(app)/copilot'],
    ['langx:///venus', '/(app)/venus'],
    ['/token', '/(app)/token'],
  ])('opens %s as the page', (url, page) => {
    expect(guestLinkPage(url)).toBe(page)
  })

  it.each([
    // Every other page of the app keeps landing a guest on Home.
    'https://app.langx.io/settings',
    'https://app.langx.io/kitchen',
    'https://app.langx.io/wallet',
    'https://app.langx.io/chat/6ae0911cf1571a6ba7c147d5',
    // Deeper than the page, or only like it.
    'https://app.langx.io/venus/stickers',
    'https://app.langx.io/tokens',
    'https://app.langx.io/Token',
    // The host is not a page, and neither is the bare app.
    'https://token.langx.io/',
    'https://app.langx.io/',
    'langx://',
    // A key every object has.
    'https://app.langx.io/constructor',
    '',
    null,
    undefined,
  ])('lands %s where it always has', (url) => {
    expect(guestLinkPage(url)).toBeNull()
  })
})
