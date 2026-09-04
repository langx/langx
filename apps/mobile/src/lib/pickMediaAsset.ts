import { isImageContentType } from '@langx/shared'
import * as ImagePicker from 'expo-image-picker'
import { Platform } from 'react-native'
import { chooseAlert } from './alert'
import { validatePickedAssets, type PickRefusal, type PickedMedia } from './pickedAssets'
import { currentTranslate } from '../i18n/runtime'

export interface PickedImage {
  uri: string
  contentType: string
  width?: number
  height?: number
}

/** Which launcher produced the result, so a refusal can name the right thing. */
export type PickSource = 'camera' | 'library'

export type PickImageResult =
  | { status: 'picked'; image: PickedImage }
  | { status: 'cancelled' }
  | { status: 'denied'; source: PickSource }
  /**
   * The library handed back a format the server does not serve. Its own
   * status rather than a thrown error because it is not a failure of anything
   * the person did — the phone chose the format — and every caller has to say
   * so in words rather than "try again", which would hit the same wall.
   */
  | { status: 'unsupported'; contentType: string }

export interface PickImageOptions {
  /** Hands the OS cropper the picture first. Avatars want it; a chat photo does not. */
  allowsEditing?: boolean
  aspect?: [number, number]
}

/**
 * Asks where the picture should come from, then returns one in a format the
 * API accepts.
 *
 * Every entry point in the app opened the photo library and only the photo
 * library — including the two composer buttons drawn with a camera glyph. On a
 * phone the picture somebody wants to send most often does not exist yet.
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
export async function pickImageAsset(options: PickImageOptions = {}): Promise<PickImageResult> {
  const source = await chooseSource()
  if (!source) return { status: 'cancelled' }

  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await requestLibraryPermission()
  if (!permission.granted) return { status: 'denied', source }

  const launchOptions: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.8,
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    ...(options.allowsEditing ? { allowsEditing: true } : {}),
    ...(options.aspect ? { aspect: options.aspect } : {}),
  }
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(launchOptions)
      : await ImagePicker.launchImageLibraryAsync(launchOptions)

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

/**
 * The Android library needs no permission, so none is asked for. On 13+ the
 * module itself asks for nothing; below that it asks for
 * `READ_EXTERNAL_STORAGE`, which `app.config.ts` blocks so that Play does not
 * treat the app as one with broad gallery access — and a request for a
 * permission the manifest does not declare comes back denied, which would have
 * read here as the person refusing. The picker that opens is the system photo
 * picker (or the documents UI on older phones), and the URI it returns is
 * readable without any grant. iOS keeps asking: PhotoKit's limited-library
 * choice is worth surfacing there.
 */
async function requestLibraryPermission(): Promise<{ granted: boolean }> {
  if (Platform.OS === 'android') return { granted: true }
  return ImagePicker.requestMediaLibraryPermissionsAsync()
}

/**
 * `null` means the question was dismissed.
 *
 * Not asked on the web. `launchCameraAsync` there is an `<input capture>`,
 * which opens the camera on a phone browser and is ignored outright on a
 * desktop one — so on a laptop "Take a photo" would open a file dialog, which
 * is worse than not offering it. Same early return as `appIcon`, `purchases`
 * and `notifications` make for the same class of reason.
 */
async function chooseSource(): Promise<PickSource | null> {
  if (Platform.OS === 'web') return 'library'
  const t = currentTranslate()
  return chooseAlert<PickSource>(t('media.sourceTitle'), undefined, [
    { label: t('media.sourceCamera'), value: 'camera' },
    { label: t('media.sourceLibrary'), value: 'library' },
  ])
}

export type PickMediaResult =
  | { status: 'picked'; media: PickedMedia[]; refused?: PickRefusal }
  | { status: 'cancelled' }
  | { status: 'denied'; source: PickSource }

export interface PickMediaOptions {
  /** How many more files the composer has room for. */
  remaining: number
}

/**
 * The composers' picker: photos *and* videos, several at a time.
 *
 * One button and one grid rather than a second "attach video" control. The OS
 * picker already shows both in one list, they share the one photo-library
 * permission, and a second button would double the composer's chrome for a
 * choice the person has already made by the time they look at their library.
 *
 * The camera stays single: `allowsMultipleSelection` means nothing to a
 * capture, and recording is one clip at a time by nature.
 *
 * Anything the server would refuse is dropped here with a reason — see
 * `validatePickedAssets`, which holds the rules and is where they are tested.
 */
export async function pickMediaAssets(options: PickMediaOptions): Promise<PickMediaResult> {
  const source = await chooseSource()
  if (!source) return { status: 'cancelled' }

  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await requestLibraryPermission()
  if (!permission.granted) return { status: 'denied', source }

  const launchOptions: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images', 'videos'],
    quality: 0.8,
    // Also what makes an iPhone hand back H.264 rather than HEVC, which
    // Android and every browser but Safari would otherwise show as a black
    // frame. Same option, second reason — see the note above.
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    ...(source === 'library'
      ? { allowsMultipleSelection: true, selectionLimit: Math.max(1, options.remaining) }
      : {}),
  }
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(launchOptions)
      : await ImagePicker.launchImageLibraryAsync(launchOptions)

  if (result.canceled || !result.assets?.length) return { status: 'cancelled' }

  const { media, refused } = validatePickedAssets(result.assets)
  return { status: 'picked', media, ...(refused ? { refused } : {}) }
}
