const { IOSConfig, withDangerousMod, withXcodeProject } = require('expo/config-plugins')
const { cpSync, readdirSync, rmSync } = require('node:fs')
const { join } = require('node:path')

/**
 * Puts the App Intents and the Siri phrases into the generated app target.
 *
 * **Why there is no other place for them.** `AppShortcutsProvider` — the
 * thing that lets somebody say "Hey Siri, open my LangX review" — has to be
 * compiled into the **main app target**, and every intent it names has to be
 * reachable from there. In an extension it builds, links, and is never heard;
 * Apple's forums are the only place that says so. The intents themselves
 * started in the widget extension for a reason of the same shape (the
 * metadata step does not run for the static library an Expo module compiles
 * into), so between the two rules there is exactly one target left.
 *
 * And this project has no committed `ios/`: `expo prebuild` writes it, so
 * anything added by hand is gone the next time somebody runs it. Hence a
 * plugin — the same arrangement `withWearApp` makes on the Android side, and
 * the same one `@bacons/apple-targets` makes for the extensions.
 *
 * It is deliberately not general-purpose. One folder, one target, names that
 * are known; a configurable version would be more code than the thing it
 * configures.
 */

/**
 * Where the copies land, relative to the app target's own group.
 *
 * **Only `app-intents/` is copied.** The two things these files need from
 * elsewhere — `PendingRoute`, which is how an intent tells the app which
 * screen it meant, and `Localizable.xcstrings`, where the intents' titles
 * come from — are already in this target: `@bacons/apple-targets` puts
 * `targets/_shared` in the app target's membership as well as the
 * extensions'. Copying them in anyway was the first version of this plugin
 * and it failed loudly, which is the good kind: *"Cannot have multiple
 * Localizable.xcstrings files in same target"*. A second `PendingRoute.swift`
 * would have been the same story one error later.
 */
const GROUP = 'AppIntents'

const withAppIntents = (config) => {
  config = withDangerousMod(config, [
    'ios',
    (modConfig) => {
      const from = join(modConfig.modRequest.projectRoot, 'app-intents')
      const into = join(
        modConfig.modRequest.platformProjectRoot,
        modConfig.modRequest.projectName,
        GROUP,
      )

      /*
       * Emptied first, for the reason `withWearApp` gives: a file deleted
       * from `app-intents/` would otherwise survive here until the next
       * `prebuild --clean`, and a stale Swift file that still compiles is
       * found weeks later, if at all. A second `AppShortcutsProvider` left
       * behind is worse than most — two providers is a build error whose
       * message names neither file.
       */
      rmSync(into, { recursive: true, force: true })
      // `recursive`, because half of what is copied is the eight `.lproj`
      // folders the phrases live in.
      cpSync(from, into, { recursive: true })
      return modConfig
    },
  ])

  return withXcodeProject(config, (modConfig) => {
    const project = modConfig.modResults
    const target = modConfig.modRequest.projectName
    const from = join(modConfig.modRequest.projectRoot, 'app-intents')

    for (const file of readdirSync(from)) {
      if (!file.endsWith('.swift')) continue
      const filepath = `${target}/${GROUP}/${file}`
      /*
       * `prebuild` runs the mods against whatever project is already there,
       * so without this the same file is added again on every run — and a
       * source listed twice in a build phase is a duplicate-symbol error at
       * link time, pointing at the symbol rather than at this loop.
       */
      if (project.hasFile(filepath)) continue
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({ filepath, groupName: target, project })
    }

    addPhrases(
      project,
      target,
      readdirSync(from).filter((file) => file.endsWith('.lproj')),
    )
    return modConfig
  })
}

/**
 * The phrases, as one localized resource in eight languages.
 *
 * Eight separate resources would not do. A `.strings` file is bound to a
 * language by the `.lproj` folder it sits in, and Xcode only reads that
 * folder when the file is a child of a **variant group** — added on its own,
 * each one is copied to the top of the bundle, where the last to be copied
 * wins and the other seven are lost. So the group is built by hand: one
 * `PBXVariantGroup` named for the file, one build file pointing at the group
 * rather than at any of its children, and each locale added underneath with
 * `variantGroup: true` so it does not get a build file of its own.
 *
 * `addKnownRegion` is the other half. A locale the project has never heard of
 * is copied but not indexed, so the app carries a translation that iOS will
 * not look up — which is the same shape as every other failure in this
 * feature: present, plausible and silent.
 */
function addPhrases(project, target, lprojs) {
  const name = 'AppShortcuts.strings'
  if (project.findPBXVariantGroupKey({ name })) return

  const groupKey = project.pbxCreateVariantGroup(name)
  const appGroup = IOSConfig.XcodeUtils.ensureGroupRecursively(project, target)
  project.addToPbxGroup(groupKey, appGroup.uuid ?? project.findPBXGroupKey({ name: target }))

  const buildFile = { uuid: project.generateUuid(), fileRef: groupKey, basename: name }
  project.addToPbxBuildFileSection(buildFile)
  project.addToPbxResourcesBuildPhase(buildFile)

  for (const lproj of lprojs) {
    const locale = lproj.replace(/\.lproj$/, '')
    /*
     * Built by hand rather than with `addResourceFile`, which cannot be used
     * here: it calls `pbxGroupByName('Resources')` and reads a property off
     * the result, and an Expo project has no group by that name — so it
     * throws inside the library with a stack that names none of this.
     */
    const fileRef = project.generateUuid()
    project.pbxFileReferenceSection()[fileRef] = {
      isa: 'PBXFileReference',
      // Named for its language, not for the file: every child of a variant
      // group has the same file name, and Xcode resolves them by region.
      name: `"${locale}"`,
      path: `"${target}/${GROUP}/${lproj}/${name}"`,
      sourceTree: '"<group>"',
      lastKnownFileType: 'text.plist.strings',
      fileEncoding: 4,
    }
    project.pbxFileReferenceSection()[`${fileRef}_comment`] = name
    project.addToPbxVariantGroup({ fileRef, basename: locale }, groupKey)
    project.addKnownRegion(locale)
  }
}

module.exports = withAppIntents
