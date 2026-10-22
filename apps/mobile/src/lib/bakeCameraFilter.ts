import { ImageFormat, Skia } from '@shopify/react-native-skia'
import { File, Paths } from 'expo-file-system'
import type { ColorMatrix } from './cameraFilters'

/** The camera's own JPEG quality, as a percentage: `takePictureAsync({ quality: 0.8 })`. */
const JPEG_QUALITY = 80

/**
 * A photo with a filter's matrix drawn into its pixels, written as a new
 * JPEG in the cache. The preview draws the same matrix over the same
 * decoded image (`FilteredPhoto`), so the file is what the person saw.
 *
 * The result replaces the shot before anything leaves the screen: the send,
 * the Save and a view-once send all get this file and never the unfiltered
 * one, which stays only in the cache the camera wrote it to.
 *
 * Throws when the photo cannot be read or drawn; the caller says so rather
 * than sending the unfiltered picture in its place.
 */
export async function bakeCameraFilter(
  uri: string,
  matrix: ColorMatrix,
): Promise<{ uri: string; width: number; height: number }> {
  const image = Skia.Image.MakeImageFromEncoded(await Skia.Data.fromURI(uri))
  if (!image) throw new Error('bakeCameraFilter: could not decode the photo')
  const width = image.width()
  const height = image.height()
  // The GPU where there is one; a CPU raster surface otherwise.
  const surface = Skia.Surface.MakeOffscreen(width, height) ?? Skia.Surface.Make(width, height)
  if (!surface) throw new Error('bakeCameraFilter: no surface')
  const paint = Skia.Paint()
  paint.setColorFilter(Skia.ColorFilter.MakeMatrix([...matrix]))
  surface.getCanvas().drawImage(image, 0, 0, paint)
  surface.flush()
  const bytes = surface.makeImageSnapshot().encodeToBytes(ImageFormat.JPEG, JPEG_QUALITY)
  if (bytes.length === 0) throw new Error('bakeCameraFilter: nothing encoded')
  const file = new File(Paths.cache, `camera-filter-${Date.now()}.jpg`)
  file.write(bytes)
  return { uri: file.uri, width, height }
}
