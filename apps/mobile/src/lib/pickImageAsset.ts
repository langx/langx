import { isImageContentType } from '@langx/shared'
import * as ImagePicker from 'expo-image-picker'

export interface PickedImage {
  uri: string
  contentType: string
  width?: number
  height?: number
}

export type PickImageResult =
  | { status: 'picked'; image: PickedImage }
  | { status: 'cancelled' }
  | { status: 'denied' }
  /**
   * The library handed back a format the server does not serve. Its own
   * status rather than a thrown error because it is not a failure of anything
   * the person did — the phone chose the format — and every caller has to say
   * so in words rather than "try again", which would hit the same wall.
   */
  | { status: 'unsupported'; contentType: string }

/**
 * Opens the photo library and returns one image in a format the API accepts.
 *
 * `preferredAssetRepresentationMode: Compatible` is the fix for HEIC. An
 * iPhone camera stores HEIC by default, and expo-image-picker passes HEIC
 * through untouched even with `quality` set — its iOS converter only
 * re-encodes the formats it does not recognise, and HEIC is one it does. The
 * upload then failed server-side with "image/heic is not a supported image
 * type", which the chat screen showed as a generic "could not be sent". In
 * `Compatible` mode PhotoKit itself delivers a JPEG, so nothing downstream
 * has to know HEIC exists. Android re-encodes to JPEG whenever `quality < 1`
 * and needs no equivalent.
 */
export async function pickImageAsset(): Promise<PickImageResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) return { status: 'denied' }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  })
  const asset = result.assets?.[0]
  if (result.canceled || !asset) return { status: 'cancelled' }

  const contentType = asset.mimeType ?? 'image/jpeg'
  // The belt to the mode's braces: a format the mode did not convert — a TIFF,
  // say — is refused here with a reason, not after a round trip to the server.
  if (!isImageContentType(contentType)) return { status: 'unsupported', contentType }

  return {
    status: 'picked',
    image: {
      uri: asset.uri,
      contentType,
      ...(asset.width ? { width: asset.width } : {}),
      ...(asset.height ? { height: asset.height } : {}),
    },
  }
}
