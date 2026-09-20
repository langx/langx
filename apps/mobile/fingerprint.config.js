/**
 * What `runtimeVersion: { policy: 'fingerprint' }` is allowed to notice.
 *
 * **npm scripts are not the native build, and must not decide who gets an
 * update.** `@expo/fingerprint` hashes `packageJson:scripts` by default, and
 * the runtime version is the key that says whether an over-the-air update may
 * reach an installed app. Those two facts met on 20 September 2026: a `--built`
 * flag added to the `deploy:web` line moved the hash from bbb9dce1 to
 * e2c8b245, and every phone already carrying the app stopped receiving updates
 * — badge art, the fix for the bug the badge art caused, everything — for a
 * change that altered no native code and could not have. The repair was to put
 * the line back character for character.
 *
 * `PackageJsonScriptsAll` takes the whole `scripts` block out of the hash, so
 * that cannot happen again. Nothing is lost by it: a script is what a developer
 * or CI types, never anything compiled into a binary. A dependency added or
 * bumped still moves the fingerprint, as it should — that is the case the
 * policy exists for.
 *
 * Written as a string rather than the `SourceSkips` constant it names, because
 * `@expo/fingerprint` is a transitive dependency here and pnpm's layout puts it
 * out of reach of a `require` from this directory. The loader accepts the name
 * (`normalizeSourceSkips`), so the constant is spelled rather than imported.
 *
 * **This file changes the fingerprint itself**, which is why it has to ship
 * with a build rather than an update: it cannot reach a phone that does not
 * already have the binary it was computed for.
 */
module.exports = {
  sourceSkips: ['PackageJsonScriptsAll'],
}
