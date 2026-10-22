import type { ColorMatrix } from './cameraFilters'

/**
 * The web has no filters (`filtersOn` in `chat-camera.tsx`): Skia there
 * would mean loading CanvasKit's WebAssembly for a screen that cannot take a
 * photo. Nothing calls these on the web; they exist so the native file's
 * Skia import never reaches the web bundle.
 */
export function bakeCameraFilter(
  _uri: string,
  _matrix: ColorMatrix,
): Promise<{ uri: string; width: number; height: number }> {
  return Promise.reject(new Error('bakeCameraFilter: not on the web'))
}

export function deleteCacheFile(_uri: string): void {}
