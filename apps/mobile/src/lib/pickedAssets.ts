import {
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_SECONDS,
  isImageContentType,
  isVideoContentType,
} from '@langx/shared'

/** One file the composer is holding, before anything has been uploaded. */
export interface PickedMedia {
  kind: 'image' | 'video'
  uri: string
  contentType: string
  durationSeconds?: number
  width?: number
  height?: number
}

/**
 * Why a picked file was dropped.
 *
 * Its own value rather than a thrown error because none of these is a failure
 * of anything the person did — the phone chose the format, the camera chose
 * the bitrate — and every caller has to say so in words rather than "try
 * again", which would hit the same wall on the next attempt.
 */
export type PickRefusal =
  { reason: 'unsupported'; contentType: string } | { reason: 'tooLong' } | { reason: 'tooLarge' }

/** The subset of `ImagePicker.ImagePickerAsset` this has to read. */
export interface PickedAssetLike {
  uri: string
  mimeType?: string | null | undefined
  type?: string | null | undefined
  /** Milliseconds, and null for a still. */
  duration?: number | null | undefined
  fileSize?: number | undefined
  width?: number | undefined
  height?: number | undefined
}

/**
 * Turns what the picker handed back into what the composer can hold, dropping
 * anything the server would refuse.
 *
 * Refusing here rather than after the upload is the whole point: a sixty-four
 * megabyte video costs minutes of somebody's data before the server gets a say,
 * and the answer would be the same either way. A library pick cannot be
 * trimmed — `videoMaxDuration` only bounds what the camera records — so a long
 * clip has to be refused with a reason rather than silently shortened.
 *
 * Pure, and importing nothing from react-native, so the rules are tested.
 */
export function validatePickedAssets(assets: readonly PickedAssetLike[]): {
  media: PickedMedia[]
  refused?: PickRefusal
} {
  const media: PickedMedia[] = []
  let refused: PickRefusal | undefined

  for (const asset of assets) {
    const isVideo = asset.type === 'video' || (asset.mimeType?.startsWith('video/') ?? false)
    const contentType = asset.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg')

    if (isVideo) {
      // The belt to `Compatible` mode's braces. An HEVC .mov that PhotoKit did
      // not convert is refused here with a reason, not after a round trip.
      if (!isVideoContentType(contentType)) {
        refused ??= { reason: 'unsupported', contentType }
        continue
      }
      const durationSeconds =
        typeof asset.duration === 'number' ? Math.ceil(asset.duration / 1000) : undefined
      if (durationSeconds === undefined) {
        // The server requires a duration, so a clip whose length nobody can
        // read is refused rather than sent to be refused.
        refused ??= { reason: 'unsupported', contentType }
        continue
      }
      if (durationSeconds > MAX_VIDEO_SECONDS) {
        refused ??= { reason: 'tooLong' }
        continue
      }
      if (asset.fileSize !== undefined && asset.fileSize > MAX_VIDEO_BYTES) {
        refused ??= { reason: 'tooLarge' }
        continue
      }
      media.push({
        kind: 'video',
        uri: asset.uri,
        contentType,
        durationSeconds,
        ...(asset.width ? { width: asset.width } : {}),
        ...(asset.height ? { height: asset.height } : {}),
      })
      continue
    }

    if (!isImageContentType(contentType)) {
      refused ??= { reason: 'unsupported', contentType }
      continue
    }
    if (asset.fileSize !== undefined && asset.fileSize > MAX_IMAGE_BYTES) {
      refused ??= { reason: 'tooLarge' }
      continue
    }
    media.push({
      kind: 'image',
      uri: asset.uri,
      contentType,
      ...(asset.width ? { width: asset.width } : {}),
      ...(asset.height ? { height: asset.height } : {}),
    })
  }

  return { media, ...(refused ? { refused } : {}) }
}
