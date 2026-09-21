const { withAppDelegate, withInfoPlist } = require('expo/config-plugins')

/**
 * Adopts the UIScene life cycle, which iOS 27 stopped treating as optional.
 *
 * **What this fixes.** An app built against the iOS 27 SDK that has no
 * `UIApplicationSceneManifest` does not launch. UIKit traps in
 * `_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption` with
 * `SIGTRAP` and one line of explanation in the device log — *"UIScene life
 * cycle is required for apps built with this SDK"* — and from the outside it
 * is an app that opens and closes again. That is what App Review saw on
 * 21 September 2026: **Guideline 2.1(a), crashed on launch**, on iPadOS 27.
 *
 * It was never about the iPad. 2.5 passed review three days earlier because it
 * was built with Xcode 26; 2.6's binaries were the first built with Xcode 27,
 * and every one of them would have died on any iOS 27 device. The reviewer
 * happened to hold an iPad.
 *
 * **Why a plugin rather than a template.** Expo 57.0.24 ships
 * `ExpoAppSceneDelegate` and says in its own doc comment that iOS 27 requires
 * it — but neither `expo@57.0.24` nor `expo-template-bare-minimum@57.0.26`,
 * the newest there is, wires it up: the generated `AppDelegate` still creates
 * its own window and the generated `Info.plist` still has no manifest. So
 * upgrading fixes nothing and there is nothing to wait for. When a later SDK
 * does adopt it, this plugin becomes a no-op worth deleting — the
 * `includes` guards below make that safe rather than silent.
 */

/** The `@objc` name of Expo's `ExpoAppSceneDelegate`. UIKit resolves it by string. */
const SCENE_DELEGATE = 'EXExpoAppSceneDelegate'

/**
 * What the template's `AppDelegate` does and must stop doing.
 *
 * Under the scene life cycle the window belongs to the scene: the delegate
 * creates it from the `UIWindowScene`, hands it back to the app delegate so
 * `UIApplication.shared.delegate?.window` keeps answering, and starts React
 * Native into it with the cold-start URL that UIKit now delivers in
 * `connectionOptions` instead of in the launch options. An app delegate that
 * also made a window would leave two, one of them never shown.
 */
const WINDOW_BLOCK = `#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif`

const withSceneLifecycle = (config) => {
  config = withInfoPlist(config, (modConfig) => {
    modConfig.modResults.UIApplicationSceneManifest = {
      /*
       * One scene, not many. The app is a single window everywhere it runs —
       * iPhone, iPad, and the Mac where it runs as the iPad build — and
       * allowing multiple would offer a second window the router has no idea
       * about. `false` is also what keeps `window` on the app delegate
       * meaningful: with several scenes there is no single one.
       */
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: SCENE_DELEGATE,
          },
        ],
      },
    }
    return modConfig
  })

  return withAppDelegate(config, (modConfig) => {
    const { contents } = modConfig.modResults

    /*
     * Both edits are guarded rather than assumed. `prebuild` runs mods against
     * whatever is already there, and a second pass that appended the
     * conformance again would not compile — but the more important case is the
     * SDK finally shipping this itself, where the strings below simply stop
     * matching and the plugin does nothing instead of corrupting a file it no
     * longer understands.
     */
    let next = contents
    if (!next.includes('ExpoReactNativeFactoryProvider')) {
      next = next.replace(
        'class AppDelegate: ExpoAppDelegate {',
        'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {',
      )
    }
    if (next.includes(WINDOW_BLOCK)) {
      next = next.replace(
        WINDOW_BLOCK,
        `// The window and React Native are started by \`ExpoAppSceneDelegate\`
    // under the scene life cycle; see \`plugins/withSceneLifecycle.js\`.`,
      )
    }

    if (next === contents) {
      throw new Error(
        'withSceneLifecycle changed nothing in AppDelegate.swift. Either the Expo template ' +
          'adopted the scene life cycle — in which case delete this plugin — or it moved the ' +
          'code this patches, in which case the app will not launch on iOS 27 until it is fixed.',
      )
    }

    modConfig.modResults.contents = next
    return modConfig
  })
}

module.exports = withSceneLifecycle
