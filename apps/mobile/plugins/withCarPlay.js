const {
  IOSConfig,
  withDangerousMod,
  withEntitlementsPlist,
  withInfoPlist,
  withXcodeProject,
} = require('expo/config-plugins')
const { cpSync, readdirSync, rmSync } = require('node:fs')
const { join } = require('node:path')

/**
 * Puts the CarPlay scene into the generated app target, and tells iOS it is
 * there.
 *
 * Three edits, and each one is a different kind of thing: Swift that has to
 * be compiled into the **app target** (a CarPlay scene is the app, not an
 * extension — there is no CarPlay extension), an entitlement Apple grants per
 * app, and a scene configuration UIKit reads by string at launch.
 *
 * It is a sibling of `withAppIntents` rather than part of it. The copying
 * looks the same and is the same eight lines, but what it copies is the one
 * thing these two plugins do not share: intents are a feature of the app
 * anywhere it runs, and this is a second screen that exists only when a car
 * is plugged in. Folding them together would mean one plugin that fails for
 * two unrelated reasons.
 *
 * It is listed before `withSceneLifecycle` in `app.config.ts` and acts after
 * it; the guard below explains why those are the same sentence.
 *
 * **The entitlement is not free to add.** `com.apple.developer.carplay-
 * communication` is granted per App ID, on request — ours was granted on
 * 21 September 2026 — and a provisioning profile minted before that does not
 * carry it. The first build after this plugin lands needs its profile
 * regenerated, or it fails at signing with a message about a missing
 * entitlement rather than about this file.
 */

/** Where the copies land, relative to the app target's own group. */
const GROUP = 'CarPlay'

/** The role UIKit looks for when a car connects, and the class it asks for. */
const CARPLAY_ROLE = 'CPTemplateApplicationSceneSessionRoleApplication'
const SCENE_DELEGATE = 'CarPlaySceneDelegate'

const withCarPlay = (config) => {
  config = withEntitlementsPlist(config, (modConfig) => {
    modConfig.modResults['com.apple.developer.carplay-communication'] = true
    return modConfig
  })

  config = withInfoPlist(config, (modConfig) => {
    /*
     * No `audio` background mode, on purpose. It was here from 22 to 23
     * September so the car could speak messages itself; since the rows became
     * `CPMessageListItem`s, Siri does the reading and the app plays nothing in
     * the car. Keeping the mode would only keep its cost — every sound in the
     * app carrying on after somebody leaves it — for no reason left.
     */
    const manifest = modConfig.modResults.UIApplicationSceneManifest

    /*
     * Loud rather than defensive, and it fired the first time this ran.
     *
     * The manifest is written by `withSceneLifecycle`, and **mods compose
     * backwards**: `withInfoPlist` wraps the mod registered before it, so the
     * plugin listed *last* is the one that touches the file *first*. Listed
     * after it, this one arrived at an Info.plist with no manifest in it at
     * all. Writing the car's role into that would have produced an app with
     * a CarPlay scene and no window scene — which is the launch crash of
     * 21 September again, found on a device instead of in a build log.
     */
    if (manifest === undefined) {
      throw new Error(
        'withCarPlay found no UIApplicationSceneManifest. It has to act after withSceneLifecycle,' +
          ' which means being listed BEFORE it in app.config.ts — Expo runs the last plugin first.',
      )
    }

    manifest.UISceneConfigurations = {
      ...manifest.UISceneConfigurations,
      [CARPLAY_ROLE]: [
        {
          UISceneConfigurationName: 'LangX CarPlay',
          /*
           * No module prefix, because the class carries `@objc(…)`. A Swift
           * class named here without one is looked up as
           * `<module>.<class>` and not found, which UIKit reports as a scene
           * that never connects — no error, no screen, no clue.
           */
          UISceneDelegateClassName: SCENE_DELEGATE,
        },
      ],
    }
    return modConfig
  })

  config = withDangerousMod(config, [
    'ios',
    (modConfig) => {
      const from = join(modConfig.modRequest.projectRoot, 'carplay')
      const into = join(
        modConfig.modRequest.platformProjectRoot,
        modConfig.modRequest.projectName,
        GROUP,
      )

      // Emptied first for the reason `withAppIntents` gives: a file deleted
      // from `carplay/` would otherwise survive here until the next
      // `prebuild --clean`, still compiling and no longer meant.
      rmSync(into, { recursive: true, force: true })
      cpSync(from, into, { recursive: true })
      return modConfig
    },
  ])

  return withXcodeProject(config, (modConfig) => {
    const project = modConfig.modResults
    const target = modConfig.modRequest.projectName
    const from = join(modConfig.modRequest.projectRoot, 'carplay')

    for (const file of readdirSync(from)) {
      if (!file.endsWith('.swift')) continue
      const filepath = `${target}/${GROUP}/${file}`
      // `prebuild` runs against whatever project is already there, so without
      // this the same file is added on every run and the link fails on a
      // duplicate symbol that names the symbol rather than the loop.
      if (project.hasFile(filepath)) continue
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({ filepath, groupName: target, project })
    }
    return modConfig
  })
}

module.exports = withCarPlay
