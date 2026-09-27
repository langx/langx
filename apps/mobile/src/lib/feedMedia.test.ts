import { describe, expect, it } from 'vitest'
import { FEED_MEDIA_MAX_HEIGHT, feedMediaHeight } from './feedMedia'

describe('feedMediaHeight', () => {
  it('keeps a landscape shape at full width', () => {
    expect(feedMediaHeight(343, 16 / 9)).toBe(193)
  })

  it('stops a portrait video at 4:5 so the 60% autoplay rule can fire', () => {
    // 9:16 at full width on a 300-point column would be 533 tall.
    expect(feedMediaHeight(300, 9 / 16)).toBe(375)
  })

  it('never goes past the ceiling on a wide column', () => {
    expect(feedMediaHeight(760, 1)).toBe(FEED_MEDIA_MAX_HEIGHT)
  })

  it('guesses 4:3 while the shape is unknown', () => {
    expect(feedMediaHeight(300, null)).toBe(225)
    expect(feedMediaHeight(300, 0)).toBe(225)
  })
})
