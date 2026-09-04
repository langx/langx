import { describe, expect, it } from 'vitest'
import { profileHref } from './profileHref'

describe('profileHref', () => {
  it('carries the return route, encoded', () => {
    expect(profileHref('behic', '/(app)/(tabs)/discover')).toBe(
      '/(app)/profile/behic?from=%2F(app)%2F(tabs)%2Fdiscover',
    )
  })

  it('encodes a return route that has parameters of its own', () => {
    // A chat route contains a `/` that must not survive into the query string,
    // or `from` ends at the slash and the back button loses the conversation.
    const href = profileHref('behic', '/(app)/chat/abc123')
    expect(href).toContain('from=%2F(app)%2Fchat%2Fabc123')
    expect(href.split('?from=')[1]).not.toContain('/')
  })

  it('strips a leading @', () => {
    expect(profileHref('@behic', '/(app)/(tabs)/feed')).toContain('/(app)/profile/behic?')
  })
})
