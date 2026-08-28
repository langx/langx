import { describe, expect, it } from 'vitest'
import { backHref } from './backHref'

describe('backHref', () => {
  it('falls back when no origin was carried', () => {
    expect(backHref(undefined, '/(app)/me')).toBe('/(app)/me')
  })

  it('honours an origin inside the signed-in area', () => {
    expect(backHref('/(app)/chats', '/(app)/discover')).toBe('/(app)/chats')
  })

  /** `from` is a string off a URL; a back button is not a redirector. */
  it('refuses anything that is not an in-app route', () => {
    for (const hostile of [
      'https://example.com',
      '//example.com',
      '/(auth)/sign-in',
      '/(app)/../../etc',
      '',
    ]) {
      expect(backHref(hostile, '/(app)/me')).toBe('/(app)/me')
    }
  })
})
