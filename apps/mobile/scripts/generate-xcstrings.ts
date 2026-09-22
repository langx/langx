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
import {
  APPLICATION_NAME,
  applicationNameCount,
  SIRI_INTENT_EXAMPLES,
  SIRI_MESSAGING_INTENTS,
  SIRI_PHRASES,
  SIRI_SHORTCUTS,
  SIRI_SOURCE,
  tokensIn,
} from '../src/i18n/siriPhrases'
import { globSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const TARGETS = join(HERE, '../targets')
const OUT = join(TARGETS, '_shared/Localizable.xcstrings')
/**
 * The app target's Swift, which `plugins/withAppIntents.js` copies into the
 * generated Xcode project. Scanned for literals like `targets/` is, and home
 * to the one catalogue iOS reads Siri phrases out of.
 */
const APP_INTENTS = join(HERE, '../app-intents')
/**
 * The CarPlay scene, which `plugins/withCarPlay.js` copies into the same
 * target. Scanned for the same reason: a car draws two sentences — the empty
 * state and what to do about it — and both must come from the catalogues.
 */
const CARPLAY = join(HERE, '../carplay')
/**
 * The two Android modules that draw words of their own, both of which need
 * the same keys in Android's own shape.
 *
 * They are separate builds, not one: `wear/` is its own application and its
 * own APK, while `modules/car-messaging` is a library that merges into the
 * phone's. So the same `strings_generated.xml` is written twice rather than
 * shared — a resource in one is not visible to the other, and neither can
 * reach an Apple string catalogue any more than Swift can read `en.ts`.
 */
const ANDROID_RES = [
  join(HERE, '../wear/src/main/res'),
  join(HERE, '../modules/car-messaging/android/src/main/res'),
]

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
 * The phrases, as the only files iOS reads them from.
 *
 * **`AppShortcuts.strings`, not a string catalogue**, and the reason is a
 * hard floor rather than a preference: `AppShortcuts.xcstrings` is refused
 * outright below iOS 17 — *"use AppShortcuts.strings for previous
 * versions"* — and this app installs from 16.4. The catalogue was written
 * first and the build said so, which is the only place that rule is written
 * down.
 *
 * The name is fixed too. `Localizable` is not consulted for phrases whatever
 * else a target carries, so a file called anything other than
 * `AppShortcuts.strings` is a file iOS never opens.
 *
 * Keyed by the **English phrase itself** rather than by a name of our
 * choosing, which is Apple's arrangement and not ours: the literal in
 * `LangXShortcuts.swift` is the key, and a translation sits under it. That is
 * why `siriPhrases.ts` keeps a fixed pair per shortcut in every language —
 * the pairing is positional, so a locale with three phrases where English has
 * two would put a translation under the wrong sentence.
 */
function shortcutFiles(): Map<string, string> {
  const files = new Map<string, string>()

  for (const locale of Object.keys(catalogs) as (keyof typeof SIRI_PHRASES)[]) {
    const rows = SIRI_SHORTCUTS.flatMap((shortcut) =>
      SIRI_PHRASES[SIRI_SOURCE][shortcut].map((source, index) => {
        const value = SIRI_PHRASES[locale][shortcut][index] ?? source
        return `${quote(source)} = ${quote(value)};`
      }),
    )
    files.set(
      join(`${locale}.lproj`, 'AppShortcuts.strings'),
      `/* Generated by scripts/generate-xcstrings.ts. Do not edit. */\n${rows.join('\n')}\n`,
    )
  }
  return files
}

/**
 * The SiriKit example phrases, one `AppIntentVocabulary.plist` per language.
 *
 * A different mechanism from the App Shortcuts above, and older: SiriKit's
 * messaging intents read their examples from this file in the **app**
 * bundle's `<locale>.lproj`, and App Store Connect checks for it at upload —
 * ITMS-90626 for every intent × language that has none. It does not fail the
 * build and does not fail the upload; it arrives by mail afterwards, which is
 * how 2.6's build 172 found out.
 *
 * Written next to `AppShortcuts.strings` in `app-intents/<locale>.lproj`, so
 * `withAppIntents` puts both into the same kind of variant group.
 */
function vocabularyFiles(): Map<string, string> {
  const files = new Map<string, string>()

  for (const locale of Object.keys(catalogs) as (keyof typeof SIRI_INTENT_EXAMPLES)[]) {
    const phrases = SIRI_MESSAGING_INTENTS.map(
      (intent) =>
        `    <dict>\n` +
        `      <key>IntentName</key>\n` +
        `      <string>${intent}</string>\n` +
        `      <key>IntentExamples</key>\n` +
        `      <array>\n` +
        `        <string>${xml(SIRI_INTENT_EXAMPLES[locale][intent])}</string>\n` +
        `      </array>\n` +
        `    </dict>`,
    )
    files.set(
      join(`${locale}.lproj`, 'AppIntentVocabulary.plist'),
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n` +
        `<!-- Generated by scripts/generate-xcstrings.ts from src/i18n/siriPhrases.ts. Do not edit. -->\n` +
        `<plist version="1.0">\n<dict>\n  <key>IntentPhrases</key>\n  <array>\n` +
        `${phrases.join('\n')}\n  </array>\n</dict>\n</plist>\n`,
    )
  }
  return files
}

/** Text inside a plist `<string>`: the three characters XML reserves there. */
function xml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** A `.strings` value: quoted, with the two characters that end one escaped. */
function quote(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/**
 * The rule with no error message: `${applicationName}`, exactly once, in
 * every language.
 *
 * iOS does not reject a phrase that lacks it and does not warn about one that
 * has it twice — it declines to match, permanently and silently, in that
 * language only. `siriPhrases.test.ts` says the same thing; this is here
 * because the generator is what CI runs on the Swift, and a phrase is not
 * shippable if either half disagrees.
 */
function siriPhraseProblems(): string[] {
  const problems: string[] = []

  for (const locale of Object.keys(catalogs) as (keyof typeof SIRI_PHRASES)[]) {
    for (const shortcut of SIRI_SHORTCUTS) {
      SIRI_PHRASES[locale][shortcut].forEach((phrase, index) => {
        const count = applicationNameCount(phrase)
        if (count !== 1) {
          problems.push(
            `${locale}/${shortcut}: "${phrase}" has ${APPLICATION_NAME} ${count} times, not once`,
          )
        }
        /*
         * And every other token English had. A parameter dropped in one
         * language is the same failure as the app name dropped in one
         * language — that phrase matches nothing, in that language, for ever
         * — and it is the likelier of the two, because `${conversation}`
         * reads like a placeholder somebody could translate.
         */
        const want = [...tokensIn(SIRI_PHRASES[SIRI_SOURCE][shortcut][index] ?? '')].sort()
        const have = [...tokensIn(phrase)].sort()
        if (want.join() !== have.join()) {
          problems.push(
            `${locale}/${shortcut}: "${phrase}" names ${have.join(', ') || 'nothing'} where English names ${want.join(', ')}`,
          )
        }
      })
    }
  }
  return problems
}

/**
 * Every phrase Swift declares has to be a phrase this file wrote.
 *
 * The literal scan below cannot see these — a phrase carries
 * `\(.applicationName)`, and a literal with a backslash in it is skipped as
 * an interpolation. So they are checked here instead, and the check is the
 * same one that caught `intents.openReview` against a catalogue holding
 * `intents.openEcho`: a phrase Apple has no translation for falls back to
 * English, which means Siri answers a Turkish speaker in English rather than
 * failing in a way anybody notices.
 */
function unknownSiriPhrases(): string[] {
  const known = new Set(
    SIRI_SHORTCUTS.flatMap((shortcut) => [...SIRI_PHRASES[SIRI_SOURCE][shortcut]]),
  )
  const problems: string[] = []

  for (const file of globSync('**/*.swift', { cwd: APP_INTENTS })) {
    const source = readFileSync(join(APP_INTENTS, file), 'utf8')
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    for (const [, literal] of code.matchAll(/"([^"\n]*\\\(\.applicationName\)[^"\n]*)"/g)) {
      if (literal === undefined) continue
      // Swift spells a parameter `\(\.$name)` and the catalogue spells it
      // `${name}`; one is the other, and this is the only place that knows.
      const key = literal
        .replace('\\(.applicationName)', APPLICATION_NAME)
        .replace(/\\\(\\\.\$([a-zA-Z]+)\)/g, '${$1}')
      if (!known.has(key)) {
        problems.push(`${relative(process.cwd(), join(APP_INTENTS, file))}: "${literal}"`)
      }
    }
  }
  return problems
}

/**
 * The same keys again, as Android string resources.
 *
 * Wear OS is a second native surface with words of its own, and it cannot
 * read an Apple string catalogue any more than Swift can read `en.ts`. So the
 * generator writes both: one catalogue for the Apple targets and one
 * `strings_generated.xml` per locale for the watch module. Same list, same
 * source, one place to add a word.
 *
 * The file is separate from the hand-written `values/strings.xml` on purpose —
 * that one holds `app_name`, a proper noun, and nothing generated should be
 * able to overwrite it.
 *
 * Android's locale folders are not the same spelling as Apple's: `pt-BR`
 * becomes `values-pt-rBR`, and the source language has no suffix at all.
 */
function androidFiles(): Map<string, string> {
  const files = new Map<string, string>()

  for (const [locale, catalog] of Object.entries(catalogs)) {
    const rows = NATIVE_KEYS.map((key) => {
      // Apostrophes and quotes are Android string syntax, not text, and a raw
      // one makes `aapt` fail on a file nobody edited by hand.
      const value = resolve(catalog, key, locale)
        .replace(/[\\]/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
      return `  <string name="${key.replace(/\./g, '_')}">${value}</string>`
    })

    const folder =
      locale === SOURCE ? 'values' : `values-${locale.replace(/^([a-z]+)-([A-Z]+)$/, '$1-r$2')}`
    files.set(
      join(folder, 'strings_generated.xml'),
      `<?xml version="1.0" encoding="utf-8"?>\n` +
        `<!-- Generated by scripts/generate-xcstrings.ts. Do not edit. -->\n` +
        `<resources>\n${rows.join('\n')}\n</resources>\n`,
    )
  }
  return files
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
 * **The test is a space, and a letter.** Rather than list the dozens of
 * SwiftUI parameters that localize, this flags any string literal containing
 * a space, anywhere in a target, unless it is a key this generator emits.
 * Prose has spaces; keys, bundle identifiers, date formats and `UserDefaults`
 * keys do not. A literal with no letter in it is not prose either — the car's
 * rows are joined with `" · "` — so the two tests together are what a
 * sentence has to pass. It is a heuristic, and it is the one that catches the
 * failure this is about while leaving the identifiers these files are full of
 * alone.
 *
 * Interpolations are skipped — a literal with a `\(…)` in it is a format
 * string, and the only ones here are in log lines nobody reads on a wrist.
 * `Text(snapshot.labels.streak)` is not a literal at all: that is the widgets'
 * way of speaking eight languages without any of this, and it stays allowed.
 */
function unlocalizedSwiftLiterals(): string[] {
  const allowed = new Set<string>(NATIVE_KEYS)
  const namespaces = new Set(NATIVE_KEYS.map((key) => key.split('.')[0]))
  const problems: string[] = []

  const swift = [
    ...globSync('**/*.swift', { cwd: TARGETS }).map((file) => join(TARGETS, file)),
    // The app target's Swift lives outside `targets/` but obeys the same
    // rule: it draws words, and none of them may be written in it.
    ...globSync('**/*.swift', { cwd: APP_INTENTS }).map((file) => join(APP_INTENTS, file)),
    ...globSync('**/*.swift', { cwd: CARPLAY }).map((file) => join(CARPLAY, file)),
  ]

  for (const path of swift) {
    const source = readFileSync(path, 'utf8')
    // Comments are prose by definition and explain the code rather than
    // appearing on a screen, so they are stripped before the scan.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    const where = relative(process.cwd(), path)

    for (const [, literal] of code.matchAll(/"([^"\\\n]*)"/g)) {
      if (literal === undefined) continue
      if (allowed.has(literal)) continue

      if (literal.includes(' ') && /\p{L}/u.test(literal)) {
        problems.push(`${where}: "${literal}"`)
        continue
      }
      /*
       * A key that does not exist, which the space test cannot see.
       *
       * `LocalizedStringResource("intents.openReview")` against a catalogue
       * that only has `intents.openEcho` compiles, links, extracts into the
       * App Intents metadata, and then shows the wearer or the Shortcuts app
       * the raw key. It looks like a typo in the product rather than a
       * missing translation. The same fallback-to-itself behaviour that makes
       * the space test necessary is what makes this necessary too.
       *
       * The test is the *namespace*, not the shape. A dotted path alone
       * catches `group.tech.newchapter.languageXchange` — the App Group, a
       * reverse-DNS identifier these files are full of. What cannot be
       * innocent is a literal whose first segment is one this generator
       * emits: if it starts with `watch.` or `intents.` it was meant to be a
       * key, and the list of namespaces maintains itself.
       */
      const namespace = literal.split('.')[0]
      if (namespace !== undefined && namespaces.has(namespace)) {
        problems.push(`${where}: "${literal}" (looks like a key, and is not one)`)
      }
    }
  }
  return problems
}

const next = build()
const shortcuts = new Map([...shortcutFiles(), ...vocabularyFiles()])
const android = androidFiles()

function readOr(path: string): string {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return ''
  }
}

if (process.argv.includes('--check')) {
  const phrases = [...siriPhraseProblems(), ...unknownSiriPhrases()]
  if (phrases.length > 0) {
    console.error(
      'A Siri phrase will never be matched:\n' +
        phrases.map((p) => `  ${p}`).join('\n') +
        '\nEvery phrase needs ${applicationName} exactly once, in every locale, and has to be' +
        ' written in src/i18n/siriPhrases.ts. See app-intents/LangXShortcuts.swift.',
    )
    process.exit(1)
  }

  const literals = unlocalizedSwiftLiterals()
  if (literals.length > 0) {
    console.error(
      'A native target draws a string that is not a translated key:\n' +
        literals.map((p) => `  ${p}`).join('\n') +
        '\nAdd the key to src/i18n/messages/en.ts and src/i18n/nativeKeys.ts, then run `pnpm gen:strings`.',
    )
    process.exit(1)
  }

  const stale = [
    ...(readOr(OUT) === next ? [] : ['targets/_shared/Localizable.xcstrings']),
    ...[...shortcuts]
      .filter(([path, body]) => readOr(join(APP_INTENTS, path)) !== body)
      .map(([path]) => join('app-intents', path)),
    ...ANDROID_RES.flatMap((res) =>
      [...android]
        .filter(([path, body]) => readOr(join(res, path)) !== body)
        .map(([path]) => relative(join(HERE, '..'), join(res, path))),
    ),
  ]
  if (stale.length > 0) {
    console.error(
      `Generated strings are out of date:\n${stale.map((p) => `  ${p}`).join('\n')}\n` +
        'Run `pnpm gen:strings` and commit the result.',
    )
    process.exit(1)
  }
  console.log(
    `Generated strings are current (${NATIVE_KEYS.length} keys, Apple + ${android.size} Android locales,` +
      ` ${SIRI_SHORTCUTS.length} Siri shortcuts).`,
  )
} else {
  const phrases = [...siriPhraseProblems(), ...unknownSiriPhrases()]
  if (phrases.length > 0) {
    console.error(
      `A Siri phrase will never be matched:\n${phrases.map((p) => `  ${p}`).join('\n')}`,
    )
    process.exit(1)
  }
  writeFileSync(OUT, next)
  for (const [path, body] of shortcuts) {
    const full = join(APP_INTENTS, path)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, body)
  }
  for (const res of ANDROID_RES) {
    for (const [path, body] of android) {
      const full = join(res, path)
      mkdirSync(dirname(full), { recursive: true })
      writeFileSync(full, body)
    }
  }
  console.log(
    `Wrote ${NATIVE_KEYS.length} keys × ${Object.keys(catalogs).length} locales to the Apple catalogue and ${android.size * ANDROID_RES.length} Android resource files`,
  )
}
