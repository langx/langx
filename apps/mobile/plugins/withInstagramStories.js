const { withAndroidManifest, withInfoPlist } = require('expo/config-plugins')

/**
 * What sharing a video straight to Instagram Stories needs from the generated
 * native projects. The share itself is `react-native-share`
 * (`src/lib/instagramStory.ts`); this only lets the app see Instagram.
 *
 * iOS: `canOpenURL` answers false for any scheme the app has not declared in
 * `LSApplicationQueriesSchemes`, whether or not Instagram is installed, so
 * the button would never show and `instagram-stories://` would never open.
 * `instagram` rides along for the plain app link.
 *
 * Android 11+: package visibility hides every app the manifest does not name
 * in `<queries>`, so the `ADD_TO_STORY` intent resolves to nothing and the
 * library falls back to the Play Store page. The FileProvider that hands
 * Instagram the cached video is not here: `react-native-share` declares its
 * own (`${applicationId}.rnshare.fileprovider`, with the whole cache
 * directory as a path) and the manifest merger brings it in.
 *
 * Why not the library's own config plugin: it builds its `<queries>` list by
 * reading `./android/app/src/main/AndroidManifest.xml` from disk at config
 * time and skips any package already in it. With a stale `android/` around,
 * `expo prebuild --clean` would read the old file, decide Instagram is
 * already there, and generate a manifest without it. Both edits below are
 * additive and idempotent instead: merged with what is there, never twice.
 *
 * A native change: it moves the runtime fingerprint, so it reaches people
 * with a store build, not an OTA.
 */
const IOS_SCHEMES = ['instagram-stories', 'instagram']
const ANDROID_PACKAGES = ['com.instagram.android']

function withInstagramQuerySchemes(config) {
  return withInfoPlist(config, (config) => {
    const current = config.modResults.LSApplicationQueriesSchemes
    const schemes = Array.isArray(current) ? current : []
    for (const scheme of IOS_SCHEMES) if (!schemes.includes(scheme)) schemes.push(scheme)
    config.modResults.LSApplicationQueriesSchemes = schemes
    return config
  })
}

function withInstagramStories(config) {
  config = withInstagramQuerySchemes(config)
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest
    manifest.queries ??= [{}]
    const queries = manifest.queries[0]
    queries.package ??= []
    for (const name of ANDROID_PACKAGES) {
      if (queries.package.some((entry) => entry.$['android:name'] === name)) continue
      queries.package.push({ $: { 'android:name': name } })
    }
    return config
  })
}

module.exports = withInstagramStories
