import { deviceLinkTarget, inviteUrl, profileUrl } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { scanTarget } from './scanTarget'

describe('scanTarget', () => {
  it('reads the sign-in QR the web build draws', () => {
    expect(scanTarget(deviceLinkTarget('AB234'))).toEqual({ kind: 'device', code: 'AB234' })
  })

  it('upper-cases a code, as the approve screen would', () => {
    expect(scanTarget('langx://link-device?user_code=ab234')).toEqual({
      kind: 'device',
      code: 'AB234',
    })
  })

  it('reads the v1 scheme too', () => {
    expect(scanTarget('tech.newchapter.languagexchange://link-device?user_code=AB234')).toEqual({
      kind: 'device',
      code: 'AB234',
    })
  })

  it('reads an invite QR and a plain profile link', () => {
    expect(scanTarget(inviteUrl('deniz'))).toEqual({ kind: 'profile', handle: 'deniz' })
    expect(scanTarget(profileUrl('Deniz'))).toEqual({ kind: 'profile', handle: 'deniz' })
  })

  it('is not fooled by a route that looks like a handle, or by another host', () => {
    expect(scanTarget('https://app.langx.io/magic-link?token=x')).toBeNull()
    expect(scanTarget('https://evil.example/deniz?invite=1')).toBeNull()
  })

  /** A scanner hands over anything: a Wi-Fi sticker, a menu, an empty frame. */
  it('never throws', () => {
    for (const raw of [
      '',
      '   ',
      'WIFI:S:home;;',
      'langx://link-device?user_code=%E0%A4%A',
      'https://app.langx.io/',
    ]) {
      expect(() => scanTarget(raw)).not.toThrow()
      expect(scanTarget(raw)).toBeNull()
    }
  })
})
