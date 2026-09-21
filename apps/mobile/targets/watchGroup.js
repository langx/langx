/**
 * The App Group the watch app and its complication share.
 *
 * Required by both `expo-target.config.js` files under `targets/`, and by
 * `targets/_shared/WatchDigest.swift`, which cannot import JavaScript and
 * repeats it as a string with a comment saying so.
 *
 * **Not in `packages/shared/src/appIdentity.ts`**, where the phone's group
 * lives, for two reasons. That module is about who the app is to Apple,
 * Google and the web — values that appear in the AASA file, in the API's
 * Apple provider and in `app.config.ts`; this one never leaves the watch. And
 * that module is part of the OTA fingerprint, so editing it between builds
 * strands every update made after it, which has cost this repo merges before.
 */
module.exports = 'group.tech.newchapter.languageXchange.watch'
