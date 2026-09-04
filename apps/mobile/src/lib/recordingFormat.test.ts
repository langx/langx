import { describe, expect, it } from 'vitest'
import {
  isAllowedAudioType,
  nativeRecordingType,
  webRecorderMimeType,
  webRecordingType,
} from './recordingFormat'

describe('recordingFormat', () => {
  it('calls a native recording what it is: AAC in MP4', () => {
    // Not `audio/m4a`, which is not a registered type — `.m4a` is the
    // extension, and the server maps it back to one.
    expect(nativeRecordingType()).toBe('audio/mp4')
  })

  it('takes the browser’s own type when the server accepts it', () => {
    expect(webRecordingType('audio/mp4')).toBe('audio/mp4')
    expect(webRecordingType('audio/webm;codecs=opus')).toBe('audio/webm')
    expect(webRecordingType('AUDIO/OGG')).toBe('audio/ogg')
  })

  it('prefers mp4 when the browser can make it and said nothing useful', () => {
    expect(webRecordingType(undefined, (type) => type === 'audio/mp4')).toBe('audio/mp4')
    expect(webRecordingType('video/webm', (type) => type === 'audio/mp4')).toBe('audio/mp4')
  })

  it('falls back to webm rather than to a type the server would refuse', () => {
    expect(webRecordingType(undefined, () => false)).toBe('audio/webm')
    expect(webRecordingType('audio/flac')).toBe('audio/webm')
    expect(webRecordingType('')).toBe('audio/webm')
  })

  it('knows what the allowlist holds', () => {
    expect(isAllowedAudioType('audio/m4a')).toBe(true)
    expect(isAllowedAudioType('audio/flac')).toBe(false)
  })
})

describe('webRecorderMimeType', () => {
  it('asks for AAC with the codec spelled out where the browser can', () => {
    expect(webRecorderMimeType(() => true)).toBe('audio/mp4;codecs=mp4a.40.2')
  })

  // `isTypeSupported('audio/mp4')` is true in browsers that then produce
  // something else, so the codec is asked for first and this is the fallback.
  it('falls back to bare audio/mp4', () => {
    expect(webRecorderMimeType((type) => type === 'audio/mp4')).toBe('audio/mp4')
  })

  // Firefox. Undefined leaves the preset's own `audio/webm` in place, which is
  // what the server converts.
  it('asks for nothing when the browser can produce neither', () => {
    expect(webRecorderMimeType(() => false)).toBeUndefined()
    expect(webRecorderMimeType()).toBeUndefined()
  })
})
