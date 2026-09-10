#!/usr/bin/env node
/* global console */
/**
 * Lays the store screenshots out the way `fastlane supply` expects, so all
 * eight languages go up in one command instead of 192 drags through the Play
 * Console.
 *
 * 192 is not an exaggeration and the drags are not optional: the Play Console
 * keeps no `<input type=file>` in its page, so "Add assets" opens the
 * operating system's own file picker. Nothing can drive that but a person,
 * which is why this script and the `play` lane exist at all.
 *
 * The images live in the sibling `branding` checkout (see docs/repo-map.md),
 * one folder per language per device size. supply wants
 * `<locale>/images/<size>Screenshots/` and sorts by filename, so this only has
 * to copy and rename — the numeric prefix is what keeps the order.
 *
 *   node apps/mobile/scripts/collect-play-screenshots.mjs
 *   cd apps/mobile && fastlane play
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const MOBILE = path.resolve(HERE, '..')

/**
 * Every read is built through here and has to land inside the directory it
 * was given. `BRANDING_DIR` is a developer's own env var rather than anything
 * hostile, but it is still the one value in this script that comes from
 * outside it — so the containment check is written down instead of assumed,
 * and `..` in a name cannot walk out of the tree being copied.
 */
function within(root, ...parts) {
  const resolved = path.resolve(root, ...parts)
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    console.error(`Refusing ${resolved}: outside ${root}`)
    process.exit(1)
  }
  return resolved
}

/** Same resolution rule as the App Store script beside this one. */
function brandingRoot() {
  const root = path.resolve(HERE, '..', process.env.BRANDING_DIR ?? '../../../branding')
  if (!fs.existsSync(within(root, '2.x'))) {
    console.error(
      `No 2.x in ${root}. Check out langx/branding next to this repo, or set BRANDING_DIR.`,
    )
    process.exit(1)
  }
  return root
}

const BRANDING = brandingRoot()
const OUT = within(MOBILE, 'fastlane/metadata/android')

/**
 * Our folder name to Play's locale code. These are not Apple's: Play wants a
 * region on most of them (`tr-TR`, not `tr`) and the listing's default is
 * British rather than American English.
 *
 * **Six, not the eight the branding repo holds.** The API refuses a locale
 * that is not already a translation on the listing, and Play's thirteen are
 * `de-DE en-GB es-419 es-ES fr-FR id it-IT ja-JP ko-KR pt-BR th tr-TR zh-CN`
 * — no Russian and no Arabic. Both have artwork sitting ready in
 * `branding/2.x`; adding either needs a title and a description first, which
 * is a copy decision rather than this script's.
 *
 * The seven Play locales we have no artwork for keep falling back to `en-GB`,
 * which is where the set that everyone actually sees lives: before this
 * script ran the first time, `en-GB` was the *only* locale on the listing
 * with screenshots at all.
 *
 * Check it with `fastlane supply init` into a scratch path before adding a
 * row here.
 */
const LOCALES = {
  en: 'en-GB',
  tr: 'tr-TR',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  'pt-BR': 'pt-BR',
}

/** Our folder name to supply's directory name. */
const SIZES = {
  phone: 'phoneScreenshots',
  '7tablet': 'sevenInchScreenshots',
  '10tablet': 'tenInchScreenshots',
}

// Only the screenshots are rewritten here. Leaving the rest of
// `metadata/android` absent is what keeps supply from touching the listing
// copy, the feature graphic or the icon — see the `play` lane.
fs.rmSync(OUT, { recursive: true, force: true })
let copied = 0
for (const [ours, play] of Object.entries(LOCALES)) {
  for (const [size, supplyDir] of Object.entries(SIZES)) {
    const from = within(BRANDING, '2.x', ours, 'android', size)
    if (!fs.existsSync(from)) {
      console.error(`Missing ${from}`)
      process.exit(1)
    }
    const to = within(OUT, play, 'images', supplyDir)
    fs.mkdirSync(to, { recursive: true })
    for (const entry of fs
      .readdirSync(from)
      .filter((f) => f.endsWith('.png'))
      .sort()) {
      // `basename` twice: once to keep a name from readdir from being a path
      // at all, once to drop the extension for the numeric prefix.
      const file = path.basename(entry)
      const n = path.basename(file, '.png').padStart(2, '0')
      fs.copyFileSync(within(from, file), within(to, `${n}.png`))
      copied++
    }
  }
  console.log(`${play}: ${Object.keys(SIZES).length * 8} screenshots`)
}
console.log(`\n${copied} files in ${OUT}`)
console.log('Next: cd apps/mobile && fastlane android play')
