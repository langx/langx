#!/usr/bin/env node
/* global console */
/**
 * Lays the store screenshots out the way `fastlane deliver` expects, so all
 * eight languages go up in one command instead of 40 drags through Media
 * Manager (five slots, eight languages).
 *
 * The images live in the sibling `branding` checkout (see docs/repo-map.md),
 * one folder per language per Apple slot. Since 3.0 they are the output of
 * `tools/store-shots`, copied into `branding/3.x` without its `.work` folder
 * (the web export and raw captures, which do not belong in branding). `deliver` wants one flat
 * folder per App Store locale and works out the device from the image's own
 * dimensions, so this only has to copy and rename — the numeric prefix is
 * what keeps the order, because deliver sorts by filename.
 *
 *   node tools/store-shots/run.mjs --out ../store-shots-3.0
 *   rsync -a --exclude .work ../store-shots-3.0/ ../branding/3.x/
 *   node apps/mobile/scripts/collect-store-screenshots.mjs
 *   cd apps/mobile && fastlane deliver
 *
 * Authentication is an App Store Connect API key (.p8), not an Apple ID: no
 * password and no 2FA prompt. The same key EAS already holds works here —
 * export APP_STORE_CONNECT_API_KEY_KEY_ID, _ISSUER_ID and _KEY_FILEPATH.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Resolved from this file rather than the working directory, so it does not
// matter where the script is run from.
const HERE = path.dirname(fileURLToPath(import.meta.url))
const MOBILE = path.resolve(HERE, '..')

/** The release's folder: what `tools/store-shots/run.mjs --out` wrote. */
const SHOTS = '3.x'

/**
 * Where the branding checkout is. BRANDING_DIR overrides the sibling default
 * for a checkout kept somewhere else; either way the directory has to actually
 * look like the branding repo before anything is read out of it, so a typo
 * fails here rather than half way through a copy.
 */
function brandingRoot() {
  const root = path.resolve(HERE, '..', process.env.BRANDING_DIR ?? '../../../branding')
  if (!fs.existsSync(path.join(root, SHOTS))) {
    console.error(
      `No ${SHOTS} in ${root}. Check out langx/branding next to this repo, or set BRANDING_DIR.`,
    )
    process.exit(1)
  }
  return root
}

const BRANDING = brandingRoot()
const OUT = path.join(MOBILE, 'fastlane/screenshots')

/**
 * Our folder name to App Store Connect's locale code. Spanish is the one
 * choice rather than a mapping: Apple carries both Spain and Mexico, the copy
 * is written to work in either, and a listing can only have one of them
 * without a second translation.
 */
const LOCALES = {
  en: 'en-US',
  tr: 'tr',
  es: 'es-ES',
  ru: 'ru',
  ar: 'ar-SA',
  fr: 'fr-FR',
  de: 'de-DE',
  'pt-BR': 'pt-BR',
}

/**
 * Four phone and tablet slots, all from the 3.x set. App Store Connect's
 * "iPad 13\"" slot is APP_IPAD_PRO_3GEN_129, and it accepts 2064 × 2752 *and*
 * 2048 × 2732 — so 13/ and 12.9/ both resolve to it and sending both posts too
 * many images at a ten-image slot. Sending 13/ alone fills it, and App Store
 * Connect derives 12.9", 10.5" and 9.7" from it. The 3.x pipeline renders no
 * 12.9/ at all.
 *
 * 6.3/ (1206 × 2622) is new with 3.0: Apple's required device sizes now name
 * the 6.3" display for iPhone, and the pipeline renders it (#1907). deliver
 * maps that size to APP_IPHONE_61, which App Store Connect labels 6.3".
 */
const SLOTS = ['6.9', '6.3', '5.5', '13']

/**
 * The watch shots are still 2.x's, because the 3.x pipeline draws none — and
 * they cannot simply be left out: with `overwrite_screenshots` deliver deletes
 * every screenshot set of a locale it uploads to, the watch set included, so a
 * missing folder would empty the Apple Watch slot rather than keep it.
 *
 * deliver works the device out from the image's own dimensions, so 416 x 496
 * lands in the Apple Watch slot with nothing to configure. The slot counts
 * what it finds rather than demanding a fixed number.
 */
const WATCH = { from: '2.x', slot: 'watch' }

fs.rmSync(OUT, { recursive: true, force: true })
let copied = 0
for (const [ours, apple] of Object.entries(LOCALES)) {
  const dir = path.join(OUT, apple)
  fs.mkdirSync(dir, { recursive: true })
  for (const [set, slot] of [...SLOTS.map((s) => [SHOTS, s]), [WATCH.from, WATCH.slot]]) {
    const from = path.join(BRANDING, set, ours, 'ios', slot)
    if (!fs.existsSync(from)) {
      console.error(`Missing ${from}`)
      process.exit(1)
    }
    for (const file of fs
      .readdirSync(from)
      .filter((f) => f.endsWith('.png'))
      .sort()) {
      const n = path.basename(file, '.png').padStart(2, '0')
      fs.copyFileSync(path.join(from, file), path.join(dir, `${slot}-${n}.png`))
      copied++
    }
  }
  console.log(`${apple}: ${fs.readdirSync(dir).length} screenshots`)
}
console.log(`\n${copied} files in ${OUT}`)
console.log('Next: cd apps/mobile && fastlane deliver')
