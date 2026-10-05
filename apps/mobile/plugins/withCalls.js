const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins')

/**
 * What the WebRTC module brings into the Android build that calls do not use.
 *
 * `@livekit/react-native-webrtc` declares a `MediaProjectionService` — a
 * foreground service of type `mediaProjection`, for sharing the screen. This
 * app never shares a screen, and Play reads every foreground service type in
 * the manifest as a feature to be declared and justified, whether or not it
 * can ever start (see `blockedPermissions` in `app.config.ts` for the times
 * that cost a review). So the service is removed at manifest merge, which is
 * what `tools:node="remove"` does to an element a library declared.
 *
 * Everything else a call needs is already in the manifest by way of the
 * modules that own it: `RECORD_AUDIO` from expo-audio, `CAMERA` from
 * expo-image-picker, and the network permissions from React Native.
 *
 * A native change: it moves the runtime fingerprint, so it reaches people
 * with a store build, not an OTA.
 */
const REMOVED_SERVICES = ['com.oney.WebRTCModule.MediaProjectionService']

function withCalls(config) {
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
