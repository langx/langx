const { AndroidConfig, withAndroidManifest, withInfoPlist } = require('expo/config-plugins')

/**
 * What a call needs from the generated native projects that no library adds
 * by itself — and, first, what the WebRTC module brings into the Android build
 * that calls do not use.
 *
 * `@livekit/react-native-webrtc` declares a `MediaProjectionService` — a
 * foreground service of type `mediaProjection`, for sharing the screen. This
 * app never shares a screen, and Play reads every foreground service type in
 * the manifest as a feature to be declared and justified, whether or not it
 * can ever start (see `blockedPermissions` in `app.config.ts` for the times
 * that cost a review). So the service is removed at manifest merge, which is
 * what `tools:node="remove"` does to an element a library declared.
 *
 * Everything else a call needs on Android arrives with the module that owns
 * it: the foreground service and its permissions with `modules/calls`,
 * `RECORD_AUDIO` with expo-audio, `CAMERA` with expo-image-picker.
 *
 * A native change: it moves the runtime fingerprint, so it reaches people
 * with a store build, not an OTA.
 */
const REMOVED_SERVICES = ['com.oney.WebRTCModule.MediaProjectionService']

/*
 * And on iOS, the two background modes a call needs. `voip` is what lets a
 * PushKit push wake the app to ring; `audio` is what keeps a call's sound
 * going when the screen locks or another app comes to the front. Both are
 * added to whatever is already there — `remote-notification` comes from
 * expo-notifications — and only if missing, so a second prebuild adds
 * nothing.
 */
const BACKGROUND_MODES = ['voip', 'audio']

function withCallBackgroundModes(config) {
  return withInfoPlist(config, (config) => {
    const modes = config.modResults.UIBackgroundModes ?? []
    for (const mode of BACKGROUND_MODES) if (!modes.includes(mode)) modes.push(mode)
    config.modResults.UIBackgroundModes = modes
    return config
  })
}

function withCalls(config) {
  config = withCallBackgroundModes(config)
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults
    manifest.manifest.$['xmlns:tools'] ??= 'http://schemas.android.com/tools'
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest)
    application.service ??= []
    for (const name of REMOVED_SERVICES) {
      if (application.service.some((service) => service.$['android:name'] === name)) continue
      application.service.push({ $: { 'android:name': name, 'tools:node': 'remove' } })
    }
    return config
  })
}

module.exports = withCalls
