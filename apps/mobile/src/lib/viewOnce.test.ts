import type { MessageViewOnce } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import {
  nextSnapMode,
  pickSixteenNineSize,
  viewOnceBubbleLabel,
  viewOnceForMode,
  withoutViewOnceFallback,
} from './viewOnce'

const photo = (over: Partial<MessageViewOnce> = {}): MessageViewOnce => ({
  kind: 'image',
  replay: false,
  opens: 0,
  opensLeft: 1,
  ...over,
})

describe('withoutViewOnceFallback', () => {
  it('drops the older builds’ sentence from a view-once message only', () => {
    const fallback = '📷 View-once photo · update LangX to open it'
    expect(withoutViewOnceFallback({ body: fallback, viewOnce: photo() }).body).toBe('')
    expect(withoutViewOnceFallback({ body: 'hello' }).body).toBe('hello')
  })

  it('returns the same object when there is nothing to drop', () => {
    const message = { body: '', viewOnce: photo() }
    expect(withoutViewOnceFallback(message)).toBe(message)
  })
})

describe('viewOnceBubbleLabel', () => {
  it('tells the recipient what a tap will do', () => {
    expect(viewOnceBubbleLabel(photo(), false)).toEqual({
      title: 'viewOnce.photo',
      status: 'viewOnce.tapToView',
      opens: true,
    })
    const replay = photo({ replay: true, opens: 1, opensLeft: 1, kind: 'video' })
    expect(viewOnceBubbleLabel(replay, false)).toEqual({
      title: 'viewOnce.video',
      status: 'viewOnce.tapToReplay',
      opens: true,
    })
    expect(viewOnceBubbleLabel(photo({ opens: 1, opensLeft: 0 }), false)).toMatchObject({
      status: 'viewOnce.opened',
      opens: false,
    })
  })

  it('tells the sender what has been done, and never lets them open it', () => {
    expect(viewOnceBubbleLabel(photo(), true)).toMatchObject({
      status: 'viewOnce.sentOnce',
      opens: false,
    })
    expect(viewOnceBubbleLabel(photo({ replay: true, opensLeft: 2 }), true).status).toBe(
      'viewOnce.sentReplay',
    )
    expect(viewOnceBubbleLabel(photo({ opens: 1, opensLeft: 0 }), true).status).toBe(
      'viewOnce.opened',
    )
    expect(viewOnceBubbleLabel(photo({ replay: true, opens: 2, opensLeft: 0 }), true).status).toBe(
      'viewOnce.replayed',
    )
  })

  it('puts a screenshot first on the sender’s side', () => {
    const shot = photo({ opens: 1, opensLeft: 0, screenshotAt: '2026-10-05T12:00:00.000Z' })
    expect(viewOnceBubbleLabel(shot, true).status).toBe('viewOnce.screenshotTaken')
  })
})

describe('pickSixteenNineSize', () => {
  it('takes the largest 16:9 size up to 1080p, skipping iOS presets', () => {
    expect(pickSixteenNineSize(['Photo', 'High', '3840x2160', '1920x1080', '1280x720'])).toBe(
      '1920x1080',
    )
    expect(pickSixteenNineSize(['4032x3024', '1280x720', '640x480'])).toBe('1280x720')
  })

  it('falls back to the smallest 16:9 size when all are larger', () => {
    expect(pickSixteenNineSize(['4000x2250', '3840x2160', '4000x3000'])).toBe('3840x2160')
  })

  it('reads portrait sizes too, and gives up without any 16:9 one', () => {
    expect(pickSixteenNineSize(['1080x1920'])).toBe('1080x1920')
    expect(pickSixteenNineSize(['4032x3024', 'Photo'])).toBeUndefined()
    expect(pickSixteenNineSize([])).toBeUndefined()
  })
})

describe('the mode pill', () => {
  it('cycles view once → allow replay → keep in chat', () => {
    expect(nextSnapMode('once')).toBe('replay')
    expect(nextSnapMode('replay')).toBe('keep')
    expect(nextSnapMode('keep')).toBe('once')
  })

  it('sends a replay flag, or nothing for an ordinary message', () => {
    expect(viewOnceForMode('once')).toEqual({ replay: false })
    expect(viewOnceForMode('replay')).toEqual({ replay: true })
    expect(viewOnceForMode('keep')).toBeNull()
  })
})
