/**
 * Sharing a video straight to Instagram Stories, rather than through the
 * system share sheet.
 *
 * The native half is `react-native-share` plus `plugins/withInstagramStories.js`:
 * on iOS the video goes on the pasteboard and `instagram-stories://` opens;
 * on Android it is handed over through the `com.instagram.share.ADD_TO_STORY`
 * intent. Both need a store build that carries them — an OTA cannot add
 * either — so a binary from before them answers false here and the caller
 * falls back to the share sheet.
 *
 * The Meta app id is a parameter, not a constant: Instagram refuses a Stories
 * share without one, and the repo is public, so it is supplied at runtime.
 *
 * `react-native-share` and `expo-linking` are imported lazily: the web build
 * has no share module, and vitest cannot load either. `react-native` itself
 * is not imported here at all — a dynamic import of it rejects on a device
 * (see `noDynamicReactNativeImport.test.ts`) — so the caller passes
 * `Platform.OS` in, the way `readLocationGuideStatus` takes it.
 */

const STORIES_URL = 'instagram-stories://share'
const ANDROID_PACKAGE = 'com.instagram.android'

/** True when Instagram is installed and this build can hand it a story. */
export async function canShareToInstagramStory(platform: string): Promise<boolean> {
  try {
    if (platform === 'ios') {
      const Linking = await import('expo-linking')
      return await Linking.canOpenURL(STORIES_URL)
    }
    if (platform === 'android') {
      const { default: Share } = await import('react-native-share')
      const { isInstalled } = await Share.isPackageInstalled(ANDROID_PACKAGE)
      return isInstalled
    }
    return false
  } catch {
    // A build without the native module lands here, and so does anything
    // else that means "not possible on this device": the answer is the same.
    return false
  }
}

/**
 * Opens Instagram's story composer with `localUri` as the background video.
 * `localUri` must be a `file://` URI — on iOS the library only reads local
 * files into the pasteboard, and on Android its FileProvider only covers the
 * app's own storage. Throws when the share cannot start.
 */
export async function shareVideoToInstagramStory(localUri: string, appId: string): Promise<void> {
  if (!localUri.startsWith('file://')) throw new Error('Instagram Stories needs a file:// URI')
  if (!appId) throw new Error('Instagram Stories needs a Meta app id')
  const { default: Share, Social } = await import('react-native-share')
  await Share.shareSingle({
    // The enum rather than `Share.Social.INSTAGRAM_STORIES`: same value, but
    // only the enum narrows the options to the stories shape that takes `appId`.
    social: Social.InstagramStories,
    backgroundVideo: localUri,
    appId,
  })
}
