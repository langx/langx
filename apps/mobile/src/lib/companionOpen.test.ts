import { describe, expect, it } from 'vitest'
import { companionOpenFromUrl } from './companionOpen'

describe('companionOpenFromUrl', () => {
  it('reads a Live Activity tap from its conversation link', () => {
    expect(companionOpenFromUrl('langx:///chats/6ab042c9f1e2d3c4b5a69788')).toEqual({
      source: 'live_activity',
      target: 'chat',
    })
  })

  it('reads the three widget links', () => {
    expect(companionOpenFromUrl('langx:///me')).toEqual({ source: 'widget', target: 'me' })
    expect(companionOpenFromUrl('langx:///chats')).toEqual({ source: 'widget', target: 'chats' })
    expect(companionOpenFromUrl('langx:///echo')).toEqual({ source: 'widget', target: 'echo' })
  })

  /*
   * Everything else is somebody arriving by another road — a shared web
   * link, a verification link, an invite — and counting it here would make
   * the widgets look used by people who never saw one.
   */
  it('ignores links no companion surface produces', () => {
    expect(companionOpenFromUrl(null)).toBeNull()
    expect(companionOpenFromUrl('')).toBeNull()
    expect(companionOpenFromUrl('https://app.langx.io/chats/6ab042c9')).toBeNull()
    expect(companionOpenFromUrl('langx://chats/6ab042c9')).toBeNull()
    expect(companionOpenFromUrl('langx:///discover')).toBeNull()
    expect(companionOpenFromUrl('langx:///me/6ab042c9')).toBeNull()
    expect(companionOpenFromUrl('langx:///chats/not-an-id')).toBeNull()
  })

  it('tolerates a trailing slash or query the router may add', () => {
    expect(companionOpenFromUrl('langx:///echo/')).toEqual({ source: 'widget', target: 'echo' })
    expect(companionOpenFromUrl('langx:///me?x=1')).toEqual({ source: 'widget', target: 'me' })
  })
})
