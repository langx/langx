import * as ImagePicker from 'expo-image-picker'

export interface PickedImage {
  uri: string
  contentType: string
  /** Sent so a bubble or card can reserve the right height before the bytes land. */
  width?: number
  height?: number
}

export type PickImageResult =
  { status: 'picked'; image: PickedImage } | { status: 'cancelled' } | { status: 'denied' }

/**
 * Ask for a photo, once.
 *
 * The permission request, the launch options and the shape handed to the
 * uploader were written out in the chat composer and would have been written
 * out again in the feed composer. `quality: 0.8` in particular is a cost
 * decision, not a taste one — it belongs in one place, next to the size
 * ceilings it exists to stay under.
 *
 * Returns a discriminated result rather than throwing or returning null for
 * both refusals: "you said no" and "you changed your mind" want different
 * things said back, and a caller that cannot tell them apart shows the wrong
 * one.
 */
export async function pickImageAsset(): Promise<PickImageResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) return { status: 'denied' }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
  })
  const asset = result.assets?.[0]
  if (result.canceled || !asset) return { status: 'cancelled' }

  return {
    status: 'picked',
    image: {
      uri: asset.uri,
      contentType: asset.mimeType ?? 'image/jpeg',
      ...(asset.width ? { width: asset.width } : {}),
      ...(asset.height ? { height: asset.height } : {}),
    },
  }
}
