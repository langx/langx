import { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, MAX_VIDEO_SECONDS } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { validatePickedAssets, type PickedAssetLike } from './pickedAssets'

const photo: PickedAssetLike = {
  uri: 'file:///a.jpg',
  mimeType: 'image/jpeg',
  type: 'image',
  width: 800,
  height: 600,
}
const clip: PickedAssetLike = {
  uri: 'file:///a.mp4',
  mimeType: 'video/mp4',
  type: 'video',
  duration: 30_000,
  fileSize: 4 * 1024 * 1024,
  width: 1280,
  height: 720,
}

describe('validatePickedAssets', () => {
  it('keeps a photo and a clip together, in the order they were picked', () => {
    const { media, refused } = validatePickedAssets([photo, clip])
    expect(refused).toBeUndefined()
    expect(media.map((item) => item.kind)).toEqual(['image', 'video'])
  })

  it('reads a duration in seconds off the picker milliseconds', () => {
    const { media } = validatePickedAssets([clip])
    expect(media[0]?.durationSeconds).toBe(30)
  })

  it('refuses a clip longer than the ceiling instead of uploading it to be refused', () => {
    // A library pick cannot be trimmed, so this has to be said in words.
    const { media, refused } = validatePickedAssets([
      { ...clip, duration: (MAX_VIDEO_SECONDS + 1) * 1000 },
    ])
    expect(media).toHaveLength(0)
    expect(refused).toEqual({ reason: 'tooLong' })
  })

  it('refuses a clip heavier than the ceiling before it costs anybody data', () => {
    const { refused } = validatePickedAssets([{ ...clip, fileSize: MAX_VIDEO_BYTES + 1 }])
    expect(refused).toEqual({ reason: 'tooLarge' })
  })

  it('refuses a container the server does not serve', () => {
    const { refused } = validatePickedAssets([{ ...clip, mimeType: 'video/webm' }])
    expect(refused).toEqual({ reason: 'unsupported', contentType: 'video/webm' })
  })

  it('refuses a clip whose length nobody could read', () => {
    // The server requires a duration; sending one without it is a round trip
    // that can only end in a refusal.
    const { media, refused } = validatePickedAssets([{ ...clip, duration: null }])
    expect(media).toHaveLength(0)
    expect(refused?.reason).toBe('unsupported')
  })

  it('refuses a photo over its own ceiling', () => {
    const { refused } = validatePickedAssets([{ ...photo, fileSize: MAX_IMAGE_BYTES + 1 }])
    expect(refused).toEqual({ reason: 'tooLarge' })
  })

  it('keeps what passed and reports only the first thing that did not', () => {
    // Six good photos and one HEIC should send the six, and say once why the
    // seventh did not come.
    const { media, refused } = validatePickedAssets([
      photo,
      { ...photo, mimeType: 'image/heic' },
      { ...clip, duration: (MAX_VIDEO_SECONDS + 1) * 1000 },
    ])
    expect(media).toHaveLength(1)
    expect(refused).toEqual({ reason: 'unsupported', contentType: 'image/heic' })
  })

  it('treats an asset with no mime type as what the picker said it was', () => {
    // Android hands back a null mimeType often enough to matter.
    const { media } = validatePickedAssets([
      { uri: 'file:///b.mp4', type: 'video', mimeType: null, duration: 5000 },
    ])
    expect(media[0]).toMatchObject({ kind: 'video', contentType: 'video/mp4' })
  })
})

describe('validatePickedAssets, platform units and room', () => {
  it('reads a web duration as seconds rather than milliseconds', () => {
    // expo-image-picker documents milliseconds and its web implementation
    // returns HTML5 `video.duration`, which is seconds. Read the wrong way, a
    // 61-second clip measures 0.061 and sails past a 60-second ceiling.
    const web = { uri: 'file:///a.mp4', mimeType: 'video/mp4', type: 'video', duration: 61 }
    expect(validatePickedAssets([web], { durationUnit: 'seconds' }).refused).toEqual({
      reason: 'tooLong',
    })
    expect(validatePickedAssets([web], { durationUnit: 'milliseconds' }).media).toHaveLength(1)
  })

  it('says so when more files came back than there was room for', () => {
    const photos = Array.from({ length: 7 }, () => ({
      uri: 'file:///a.jpg',
      mimeType: 'image/jpeg',
      type: 'image',
    }))
    const { media, refused } = validatePickedAssets(photos, {
      durationUnit: 'milliseconds',
      room: 6,
    })
    expect(media).toHaveLength(6)
    expect(refused).toEqual({ reason: 'tooMany' })
  })
})
