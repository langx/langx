/**
 * Writes `targets/_shared/Localizable.xcstrings` from the app's own catalogues.
 *
 * Swift cannot import `src/i18n/messages/en.ts`, and the rule that no
 * user-facing string is written in a component does not stop being true
 * because the component is a watch screen. So the words travel: this script
 * copies the keys listed in `src/i18n/nativeKeys.ts` out of all eight
 * catalogues into an Apple string catalogue, which every native target
 * compiles because it sits in `targets/_shared`.
 *
 * **The output is committed, and CI checks it is current** (`--check`), rather
 * than the file being generated during `prebuild`. Two reasons. A prebuild
 * hook would need a TypeScript loader inside Expo's own process, which is a
 * fragile place to need one; and a committed catalogue means the eight
 * translations are visible in the diff that changes them, which is where a
 * reviewer can actually judge them. The failure mode is the same either way —
 * a stale file fails the build — but it fails in CI with a diff instead of on
 * a Mac with a stack trace.
 *
 * Run: `pnpm gen:strings` from the repo root, or `--check` to verify only.
 */
import { catalogs } from '../src/i18n/catalogs'
import { NATIVE_KEYS } from '../src/i18n/nativeKeys'
import { globSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const TARGETS = join(dirname(fileURLToPath(import.meta.url)), '../targets')
const OUT = join(TARGETS, '_shared/Localizable.xcstrings')

/**
 * The source language, which Apple treats differently from the rest: its
 * value is the key's own default and Xcode marks it as such.
 */
const SOURCE = 'en'

/**
 * Walk a dotted path into a catalogue.
 *
 * Returns a string or throws. A plural would come back as an object, and
 * there is deliberately no support for one: Apple's catalogue can express
 * plural variations, but its categories are chosen by Xcode's own locale
 * rules rather than by ours, so the two plural engines would have to agree
 * about Russian for the result to be right. Nothing native needs a counted
 * string yet. When something does, this is the function that has to grow, and
 * the test beside it says so.
 */
function resolve(catalog: unknown, key: string, locale: string): string {
  let node: unknown = catalog
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) break
    node = (node as Record<string, unknown>)[part]
  }
  if (typeof node !== 'string') {
    throw new Error(
      `${locale} has no string at "${key}" (found ${typeof node}). ` +
        `A plural cannot go to a native target yet — see resolve() in this file.`,
    )
  }
  return node
}

function build(): string {
  const strings: Record<string, unknown> = {}

  for (const key of NATIVE_KEYS) {
    const localizations: Record<string, unknown> = {}
    for (const [locale, catalog] of Object.entries(catalogs)) {
      localizations[locale] = {
        stringUnit: {
          state: locale === SOURCE ? 'new' : 'translated',
          value: resolve(catalog, key, locale),
        },
      }
    }
    strings[key] = { extractionState: 'manual', localizations }
  }

  // Apple writes this file with a trailing newline and two-space indent; match
  // it so a hand-opened Xcode and this script do not fight over the diff.
  return `${JSON.stringify({ sourceLanguage: SOURCE, strings, version: '1.0' }, null, 2)}\n`
}

/**
 * The Swift half of "no user-facing string is written in a component".
 *
 * A lint rule cannot reach Swift, so this is the rule for `targets/**`. It
 * exists because of a SwiftUI detail: `Text("…")`, `navigationTitle("…")` and
 * every other `LocalizedStringKey` parameter turn a literal into a *lookup*
 * that silently falls back to itself when the key is missing. That is exactly
 * how an English sentence ends up hard-coded on a Turkish watch with nothing
 * to show for it — no warning, no crash, a screen that looks finished.
 *
 * **The test is a space.** Rather than list the dozens of SwiftUI parameters
 * that localize, this flags any string literal containing one, anywhere in a
 * target, unless it is a key this generator emits. Prose has spaces; keys,
 * bundle identifiers, date formats and `UserDefaults` keys do not. It is a
 * heuristic, and it is the one that catches the failure this is about while
 * leaving the identifiers these files are full of alone.
 *
 * Interpolations are skipped — a literal with a `\(…)` in it is a format
 * string, and the only ones here are in log lines nobody reads on a wrist.
 * `Text(snapshot.labels.streak)` is not a literal at all: that is the widgets'
 * way of speaking eight languages without any of this, and it stays allowed.
 */
function unlocalizedSwiftLiterals(): string[] {
  const allowed = new Set<string>(NATIVE_KEYS)
  const problems: string[] = []

  for (const file of globSync('**/*.swift', { cwd: TARGETS })) {
    const source = readFileSync(join(TARGETS, file), 'utf8')
    // Comments are prose by definition and explain the code rather than
    // appearing on a screen, so they are stripped before the scan.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

    for (const [, literal] of code.matchAll(/"([^"\\\n]*)"/g)) {
      if (literal === undefined || !literal.includes(' ')) continue
      if (allowed.has(literal)) continue
      problems.push(`${relative(process.cwd(), join(TARGETS, file))}: "${literal}"`)
    }
  }
  return problems
}

const next = build()

if (process.argv.includes('--check')) {
  const literals = unlocalizedSwiftLiterals()
  if (literals.length > 0) {
    console.error(
      'A native target draws a string that is not a translated key:\n' +
        literals.map((p) => `  ${p}`).join('\n') +
        '\nAdd the key to src/i18n/messages/en.ts and src/i18n/nativeKeys.ts, then run `pnpm gen:strings`.',
    )
    process.exit(1)
  }

  const current = (() => {
    try {
      return readFileSync(OUT, 'utf8')
    } catch {
      return ''
    }
  })()
  if (current !== next) {
    console.error(
      'Localizable.xcstrings is out of date. Run `pnpm gen:strings` and commit the result.',
    )
    process.exit(1)
  }
  console.log(`Localizable.xcstrings is current (${NATIVE_KEYS.length} keys).`)
} else {
  writeFileSync(OUT, next)
  console.log(
    `Wrote ${NATIVE_KEYS.length} keys × ${Object.keys(catalogs).length} locales to ${OUT}`,
  )
}
