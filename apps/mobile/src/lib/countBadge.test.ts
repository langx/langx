import { describe, expect, it } from 'vitest'
import { ROW_BADGE_SIZE, TAB_BADGE_SIZE, countBadgeText, v3TabBadgeStyle } from './countBadge'

describe('count badge digits', () => {
  it.each([TAB_BADGE_SIZE, ROW_BADGE_SIZE])('a %ipt badge has a line as tall as itself', (size) => {
    const s = countBadgeText(size)
    expect(s.lineHeight).toBe(s.height)
    expect(s.height).toBe(size)
  })

  it("beats the label step's shorter line in the tab bar", () => {
    const s = v3TabBadgeStyle({ fontSize: 13, lineHeight: 16 }, '#00f', '#fff')
    expect(s.lineHeight).toBe(TAB_BADGE_SIZE)
    expect(s.height).toBe(TAB_BADGE_SIZE)
    expect(s.backgroundColor).toBe('#00f')
  })
})
