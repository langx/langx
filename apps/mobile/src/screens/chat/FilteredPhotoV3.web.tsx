import { Image } from 'expo-image'
import { StyleSheet } from 'react-native'
import type { ColorMatrix } from '../../lib/cameraFilters'

/**
 * The web draws the photo plain: it has no filters (see `bakeCameraFilter.web.ts`),
 * and this keeps Skia out of the web bundle.
 */
export function FilteredPhotoV3({ uri }: { uri: string; matrix: ColorMatrix }) {
  return <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" />
}
