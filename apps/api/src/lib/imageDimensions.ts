/**
 * Pixel dimensions from an image header, for the four types v2 serves
 * (`IMAGE_CONTENT_TYPES`). Returns `null` for anything it cannot read.
 *
 * Hand-rolled rather than a dependency because this is the only place in the
 * repo that needs it and the alternative is a transitive tree pulled in for
 * about forty lines of header parsing. Only the header is read — the byte
 * arrays are already in memory from the download.
 *
 * Why bother at all: without width and height, `ImageBubble` has no aspect
 * ratio until the file loads, so every migrated photo reflows the list the
 * first time it is scrolled past. Reading it here, once, during the migration
 * is cheaper than paying for it on every device that ever opens the thread.
 */
export interface Dimensions {
  width: number
  height: number
}

export function imageDimensions(bytes: Uint8Array): Dimensions | null {
  return png(bytes) ?? gif(bytes) ?? webp(bytes) ?? jpeg(bytes)
}

function png(bytes: Uint8Array): Dimensions | null {
  // \x89PNG\r\n\x1a\n, then a 13-byte IHDR whose first two fields are the size.
  if (bytes.length < 24) return null
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

function gif(bytes: Uint8Array): Dimensions | null {
  if (bytes.length < 10) return null
  if (bytes[0] !== 0x47 || bytes[1] !== 0x49 || bytes[2] !== 0x46) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  // Little-endian, unlike every other format here.
  return { width: view.getUint16(6, true), height: view.getUint16(8, true) }
}

function webp(bytes: Uint8Array): Dimensions | null {
  if (bytes.length < 30) return null
  if (ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const format = ascii(bytes, 12, 4)

  if (format === 'VP8 ') {
    // Lossy: a 3-byte start code at 23, then two 14-bit dimensions.
    return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff }
  }
  if (format === 'VP8L') {
    // Lossless: 14 bits each, packed across four bytes after the signature.
    const bits = view.getUint32(21, true)
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
  }
  if (format === 'VP8X') {
    // Extended: 24-bit little-endian, stored as (size - 1).
    const width = bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16)
    const height = bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16)
    return { width: width + 1, height: height + 1 }
  }
  return null
}

/**
 * JPEG has no fixed header — the size lives in whichever SOF marker the
 * encoder used, so the segment chain has to be walked until one turns up.
 */
function jpeg(bytes: Uint8Array): Dimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  let offset = 2
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      // Padding between segments is legal; skip a byte and keep looking.
      offset++
      continue
    }
    const marker = bytes[offset + 1]!
    // SOF0-SOF15, minus the four that are not frame headers at all
    // (DHT 0xc4, JPG 0xc8, DAC 0xcc — and 0xc9/0xcd are arithmetic-coded
    // frames, which do carry the size).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) }
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2
      continue
    }
    offset += 2 + view.getUint16(offset + 2)
  }
  return null
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length))
}
