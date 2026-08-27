import { describe, expect, it } from 'vitest'
import { isServableLegacyMedia, normalizeLegacyContentType } from './legacyMedia'

describe('normalizeLegacyContentType', () => {
  /**
   * The one that matters. Measured against the live v1 bucket: every one of
   * the 1,270 voice notes reports this type, so getting it wrong skips the
   * entire audio migration silently.
   */
  it('recognises v1 voice notes, all of which report an unusual AAC type', () => {
    expect(normalizeLegacyContentType('audio/x-hx-aac-adts')).toBe('audio/aac')
    expect(isServableLegacyMedia('audio/x-hx-aac-adts', 'audio')).toBe(true)
  })

  it('passes through what is already standard', () => {
    expect(normalizeLegacyContentType('image/jpeg')).toBe('image/jpeg')
    expect(normalizeLegacyContentType('audio/mp4')).toBe('audio/mp4')
  })

  it('ignores case and trailing parameters', () => {
    expect(normalizeLegacyContentType('IMAGE/JPEG')).toBe('image/jpeg')
    expect(normalizeLegacyContentType('audio/aac; charset=binary')).toBe('audio/aac')
  })

  /** v1 accepted attachments v2 has no way to render. Those stay out. */
  it('rejects what v2 cannot serve', () => {
    expect(isServableLegacyMedia('application/pdf', 'image')).toBe(false)
    expect(isServableLegacyMedia('', 'image')).toBe(false)
    // Right family, wrong slot — an image must not arrive as a voice note.
    expect(isServableLegacyMedia('image/jpeg', 'audio')).toBe(false)
  })

  it('accepts every image type v1 actually holds', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(isServableLegacyMedia(type, 'image')).toBe(true)
    }
  })
})
