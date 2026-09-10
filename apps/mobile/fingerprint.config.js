// Keeps the version and the build number out of the fingerprint. The runtime
// version is meant to change when the native layer does; a number that changes
// on every build would make each store build its own runtime, and the update
// `main` publishes would match no installed binary. Two entries are needed
// because the number reaches the config in two ways: as `ios.buildNumber` /
// `android.versionCode` (the skip), and as the root package.json that
// `app.config.ts` imports, which the fingerprint hashes as a file (the ignore).
// Neither eas-cli nor expo-updates applies either on its own. The second skip
// is the library's default, which setting the field replaces.
/** @type {import('expo/fingerprint').Config} */
module.exports = {
  sourceSkips: ['ExpoConfigVersions', 'PackageJsonAndroidAndIosScriptsIfNotContainRun'],
  ignorePaths: ['../../package.json'],
}
