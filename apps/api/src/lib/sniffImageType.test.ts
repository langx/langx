import { describe, expect, it } from 'vitest'
import { sniffImageType } from './sniffImageType'

function bytes(...head: number[]): Uint8Array {
  const out = new Uint8Array(32)
  out.set(head)
  return out
}

function ascii(text: string, at: number, into: Uint8Array): Uint8Array {
  for (let i = 0; i < text.length; i++) into[at + i] = text.charCodeAt(i)
  return into
}

describe('sniffImageType', () => {
  it('reads PNG, GIF and JPEG from their signatures', () => {
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47))).toBe('image/png')
    expect(sniffImageType(bytes(0x47, 0x49, 0x46, 0x38))).toBe('image/gif')
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg')
  })

  it('reads WEBP, which needs both halves of its header', () => {
    const webp = ascii('WEBP', 8, ascii('RIFF', 0, new Uint8Array(32)))
    expect(sniffImageType(webp)).toBe('image/webp')
    // RIFF alone is a container, not a picture.
    expect(sniffImageType(ascii('RIFF', 0, new Uint8Array(32)))).toBeNull()
  })

  it('answers null rather than guessing', () => {
    expect(sniffImageType(bytes(0x00, 0x01, 0x02, 0x03))).toBeNull()
    expect(sniffImageType(new Uint8Array(4))).toBeNull()
    expect(sniffImageType(new Uint8Array())).toBeNull()
  })
})
