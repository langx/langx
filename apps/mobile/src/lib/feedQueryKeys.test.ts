import { describe, expect, it } from 'vitest'
import { FOLLOW_INVALIDATES, TIMELINE_KEY, reaches, timelinePath } from './feedQueryKeys'

describe('the timeline key', () => {
  it('sits under the prefix every feed patcher walks', () => {
    expect(reaches(['feed'], TIMELINE_KEY)).toBe(true)
  })

  it('is not "My posts" and not an old section', () => {
    expect(reaches(TIMELINE_KEY, ['feed', 'mine'])).toBe(false)
    expect(reaches(TIMELINE_KEY, ['feed', 'correction'])).toBe(false)
    expect(reaches(TIMELINE_KEY, ['feed', 'pronunciation'])).toBe(false)
  })
})

describe('following somebody', () => {
  /*
   * A refetch of the timeline re-reads every loaded page, each a ranked window
   * read, and re-sorts the list under the reader's finger. The plan moves that
   * to the next pull-to-refresh; this is what keeps a well-meant `['feed']`
   * from quietly coming back.
   */
  it('does not reach the timeline', () => {
    for (const prefix of FOLLOW_INVALIDATES) expect(reaches(prefix, TIMELINE_KEY)).toBe(false)
  })

  it('still refreshes the follower lists and the old section keys', () => {
    expect(
      FOLLOW_INVALIDATES.some((prefix) => reaches(prefix, ['follows', 'u1', 'following'])),
    ).toBe(true)
    expect(FOLLOW_INVALIDATES.some((prefix) => reaches(prefix, ['feed', 'correction']))).toBe(true)
  })
})

describe('timelinePath', () => {
  it('asks for page one without a cursor, and encodes one when there is', () => {
    expect(timelinePath('')).toBe('/feed/timeline')
    expect(timelinePath('tl1.t.1727430000000-abc')).toBe(
      '/feed/timeline?cursor=tl1.t.1727430000000-abc',
    )
    expect(timelinePath('a|b')).toBe('/feed/timeline?cursor=a%7Cb')
  })
})
