import { describe, expect, it } from 'vitest'
import { objectExtension } from './objectExtension'

describe('objectExtension', () => {
  it('gives an iPhone video an extension something recognises', () => {
    // Every video from an iPhone arrives as video/quicktime, and `.quicktime`
    // is not an extension any player or browser knows.
    expect(objectExtension('video/quicktime')).toBe('mov')
  })

  it('takes the subtype when it is already the extension', () => {
    expect(objectExtension('video/mp4')).toBe('mp4')
    expect(objectExtension('audio/m4a')).toBe('m4a')
    expect(objectExtension('image/png')).toBe('png')
  })

  it('maps the ones whose subtype is a name rather than an extension', () => {
    expect(objectExtension('image/jpeg')).toBe('jpg')
    expect(objectExtension('audio/mpeg')).toBe('mp3')
  })

  it('ignores parameters after the type', () => {
    expect(objectExtension('audio/webm; codecs=opus')).toBe('webm')
  })

  it('falls back rather than writing a key with no extension', () => {
    expect(objectExtension('garbage')).toBe('bin')
  })
})
