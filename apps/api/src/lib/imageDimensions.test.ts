import { describe, expect, it } from 'vitest'
import { imageDimensions } from './imageDimensions'

/**
 * Real headers, byte for byte — the offsets are the entire risk here, and a
 * parser that reads the wrong two bytes returns a plausible-looking number
 * rather than failing, which is how a migrated photo ends up stretched.
 */
function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const view = new DataView(bytes.buffer)
  view.setUint32(8, 13) // IHDR length
  bytes.set([0x49, 0x48, 0x44, 0x52], 12) // "IHDR"
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes
}

function gif(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(13)
  bytes.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]) // "GIF89a"
  const view = new DataView(bytes.buffer)
  view.setUint16(6, width, true)
  view.setUint16(8, height, true)
  return bytes
}

/** FFD8, an APP0 segment to walk past, then the SOF0 that actually carries the size. */
function jpeg(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(40)
  const view = new DataView(bytes.buffer)
  bytes.set([0xff, 0xd8], 0)
  bytes.set([0xff, 0xe0], 2)
  view.setUint16(4, 16) // APP0 length, so the next marker sits at 20
  bytes.set([0xff, 0xc0], 20)
  view.setUint16(22, 17)
  bytes[24] = 8 // sample precision
  view.setUint16(25, height)
  view.setUint16(27, width)
  return bytes
}

function webpVP8X(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(30)
  const ascii = (text: string, at: number) => {
    for (const [index, char] of [...text].entries()) bytes[at + index] = char.charCodeAt(0)
  }
  ascii('RIFF', 0)
  ascii('WEBP', 8)
  ascii('VP8X', 12)
  // Canvas size is stored as 24-bit little-endian (size - 1).
  const w = width - 1
  const h = height - 1
  bytes.set([w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff], 24)
  bytes.set([h & 0xff, (h >> 8) & 0xff, (h >> 16) & 0xff], 27)
  return bytes
}

describe('imageDimensions', () => {
  it('reads PNG', () => {
    expect(imageDimensions(png(1200, 1600))).toEqual({ width: 1200, height: 1600 })
  })

  it('reads GIF', () => {
    expect(imageDimensions(gif(320, 240))).toEqual({ width: 320, height: 240 })
  })

  it('reads JPEG, walking past the segments before the frame header', () => {
    expect(imageDimensions(jpeg(4032, 3024))).toEqual({ width: 4032, height: 3024 })
  })

  it('reads extended WebP', () => {
    expect(imageDimensions(webpVP8X(800, 600))).toEqual({ width: 800, height: 600 })
  })

  it('keeps portrait and landscape apart', () => {
    // The failure that matters: swapped width/height crops a portrait photo to
    // a square, and no viewer can get the missing part back.
    expect(imageDimensions(png(900, 1600))).toEqual({ width: 900, height: 1600 })
    expect(imageDimensions(jpeg(900, 1600))).toEqual({ width: 900, height: 1600 })
  })

  it('returns null rather than a guess for anything it cannot read', () => {
    expect(imageDimensions(new Uint8Array([1, 2, 3]))).toBeNull()
    expect(imageDimensions(new Uint8Array(64))).toBeNull()
  })
})
