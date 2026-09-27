import { describe, expect, it } from 'vitest'
import { linkedParts } from './linkedParts'

describe('linkedParts', () => {
  it('is null for a sentence with nothing to tap, an email address included', () => {
    expect(linkedParts('merhaba, nasılsın?')).toBeNull()
    expect(linkedParts('write to anna@gmail.com')).toBeNull()
  })

  it('cuts text, addresses and mentions in the order they are written', () => {
    expect(linkedParts('ask @deniz about langx.io/pro, ok?')).toEqual([
      { at: 0, text: 'ask ' },
      { at: 4, text: '@deniz', handle: 'deniz' },
      { at: 10, text: ' about ' },
      { at: 17, text: 'langx.io/pro', href: 'https://langx.io/pro' },
      { at: 29, text: ', ok?' },
    ])
  })

  it('draws a message that is only a mention as that mention', () => {
    expect(linkedParts('@Deniz')).toEqual([{ at: 0, text: '@Deniz', handle: 'deniz' }])
  })

  it('gives an address the tap when a mention sits inside it', () => {
    const text = 'see https://example.com/?ref=@deniz now'
    expect(linkedParts(text)).toEqual([
      { at: 0, text: 'see ' },
      { at: 4, text: 'https://example.com/?ref=@deniz', href: 'https://example.com/?ref=@deniz' },
      { at: 35, text: ' now' },
    ])
  })

  it('keeps a mention that only comes after an address', () => {
    expect(linkedParts('https://langx.io @anna')).toEqual([
      { at: 0, text: 'https://langx.io', href: 'https://langx.io' },
      { at: 16, text: ' ' },
      { at: 17, text: '@anna', handle: 'anna' },
    ])
  })
})

describe('linkedParts with formatting', () => {
  it('drops the markers and styles what they held', () => {
    expect(linkedParts('a *big* _deal_')).toEqual([
      { at: 0, text: 'a ' },
      { at: 3, text: 'big', style: 'bold' },
      { at: 7, text: ' ' },
      { at: 9, text: 'deal', style: 'italic' },
    ])
  })

  it('keeps a link inside a span tappable, and styled', () => {
    expect(linkedParts('~see langx.io~')).toEqual([
      { at: 1, text: 'see ', style: 'strike' },
      { at: 5, text: 'langx.io', href: 'https://langx.io', style: 'strike' },
    ])
  })

  it('groups what a spoiler hides', () => {
    expect(linkedParts('he ||asks @anna|| ok')).toEqual([
      { at: 0, text: 'he ' },
      {
        at: 3,
        spoiler: [
          { at: 5, text: 'asks ' },
          { at: 10, text: '@anna', handle: 'anna' },
        ],
      },
      { at: 17, text: ' ok' },
    ])
  })

  it('is still null for markers that format nothing', () => {
    expect(linkedParts('2*3*4 and snake_case_name')).toBeNull()
  })
})
