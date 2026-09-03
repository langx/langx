import { describe, expect, it } from 'vitest'
import { unreadBadge, UNREAD_BADGE_MAX } from './unreadBadge'

describe('unreadBadge', () => {
  it('draws nothing when there is nothing unread', () => {
    // Not '0': the tab bar draws a badge for any string, and a zero on a tab
    // says "something is waiting" as loudly as a one does.
    expect(unreadBadge(0)).toBeUndefined()
  })

  it('draws nothing before the count has loaded', () => {
    expect(unreadBadge(undefined)).toBeUndefined()
  })

  it('draws the count itself while it fits', () => {
    expect(unreadBadge(1)).toBe('1')
    expect(unreadBadge(UNREAD_BADGE_MAX)).toBe('99')
  })

  it('caps rather than widening the tab', () => {
    expect(unreadBadge(UNREAD_BADGE_MAX + 1)).toBe('99+')
    expect(unreadBadge(1482)).toBe('99+')
  })

  it('treats a negative count as nothing, rather than drawing a minus sign', () => {
    expect(unreadBadge(-3)).toBeUndefined()
  })
})
