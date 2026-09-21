import { describe, expect, it } from 'vitest'
import { pendingRouteHref } from './pendingRoute'

describe('pendingRouteHref', () => {
  it('lets the two tab routes through', () => {
    expect(pendingRouteHref('/echo')).toBe('/echo')
    expect(pendingRouteHref('/chats')).toBe('/chats')
  })

  it('opens a conversation by id', () => {
    expect(pendingRouteHref('/chat/68c0ff1e2a4b5c6d7e8f9a0b')).toBe(
      '/chat/68c0ff1e2a4b5c6d7e8f9a0b',
    )
  })

  it('is null for nothing, and for a route this build has no screen for', () => {
    expect(pendingRouteHref(null)).toBeNull()
    expect(pendingRouteHref('')).toBeNull()
    expect(pendingRouteHref('/wallet')).toBeNull()
  })

  /**
   * The id is the only part of a pending route that is not a constant, so it
   * is the only part that can carry something else. None of these is likely
   * from our own extensions; all of them are cheap to refuse.
   */
  it('refuses an id that is not one', () => {
    for (const route of [
      '/chat/',
      '/chat/../settings',
      '/chat/abc?next=/settings',
      '/chat/abc/def',
      `/chat/${'a'.repeat(65)}`,
      '/chat/NotHex',
    ]) {
      expect({ route, href: pendingRouteHref(route) }).toEqual({ route, href: null })
    }
  })
})
