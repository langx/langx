import { requireOptionalNativeModule } from 'expo'
import type { ColorMatrix } from '../../src/lib/cameraFilters'

/**
 * Draws a camera filter into a recorded clip, as `bakeCameraFilter` does
 * into a photo: the same 4×5 matrix, written into a new file, so what is
 * sent is what the preview showed and every reader sees it — an older app,
 * the web, a saved copy.
 *
 * Native because nothing in JavaScript can encode video. iOS runs the matrix
 * through Core Image (`CIColorMatrix`) under an `AVAssetReader` → `AVAssetWriter`
 * pass; Android through Media3 Transformer, as a colour lookup table built
 * from the same matrix, since Media3's own matrix effect has no offsets.
 * Both write H.264 at `bitrate` with the sound copied as it is.
 *
 * `requireOptionalNativeModule`, as the other local modules: the web, and a
 * binary built before this module, get `null`, and `canFilterVideo` says so,
 * so the camera offers filters on photos only there.
 */
interface VideoFilterNativeModule {
  apply: (uri: string, matrix: number[], bitrate: number) => Promise<string>
}

const native = requireOptionalNativeModule<VideoFilterNativeModule>('VideoFilter')

export function canFilterVideo(): boolean {
  return native !== null
}

/** A new MP4 in the cache with the filter drawn in; its `file://` URI. */
export function filterVideo(uri: string, matrix: ColorMatrix, bitrate: number): Promise<string> {
  if (!native) return Promise.reject(new Error('Video filters are not in this build'))
  return native.apply(uri, [...matrix], bitrate)
}
