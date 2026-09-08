#!/usr/bin/env node
/* global console */
/**
 * Lays the store screenshots out the way `fastlane deliver` expects, so all
 * eight languages go up in one command instead of 32 drags through Media
 * Manager.
 *
 * The images live in the sibling `branding` checkout (see docs/repo-map.md),
 * one folder per language per Apple slot. `deliver` wants one flat folder per
 * App Store locale and works out the device from the image's own dimensions,
 * so this only has to copy and rename — the numeric prefix is what keeps the
 * order, because deliver sorts by filename.
 *
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

/**
 * Where the branding checkout is. BRANDING_DIR overrides the sibling default
 * for a checkout kept somewhere else; either way the directory has to actually
 * look like the branding repo before anything is read out of it, so a typo
 * fails here rather than half way through a copy.
 */
function brandingRoot() {
  const root = path.resolve(HERE, '..', process.env.BRANDING_DIR ?? '../../../branding')
  if (!fs.existsSync(path.join(root, '2.0.x'))) {
    console.error(
      `No 2.0.x in ${root}. Check out langx/branding next to this repo, or set BRANDING_DIR.`,
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
 * Three slots, not the four the folder holds. App Store Connect's "iPad 13\""
 * slot is APP_IPAD_PRO_3GEN_129, and it accepts 2064 × 2752 *and* 2048 × 2732
 * — so 13/ and 12.9/ both resolve to it, deliver posts sixteen images at a
 * ten-image slot, and six of each set are dropped. Sending 13/ alone fills it
 * correctly and App Store Connect derives 12.9", 10.5" and 9.7" from it, the
 * same way it derives 6.5" and the rest from 6.9".
 *
 * 12.9/ stays in the branding repo: Play has no such derivation, and a future
 * App Store Connect may split the slots again.
 */
const SLOTS = ['6.9', '5.5', '13']

fs.rmSync(OUT, { recursive: true, force: true })
let copied = 0
for (const [ours, apple] of Object.entries(LOCALES)) {
  const dir = path.join(OUT, apple)
  fs.mkdirSync(dir, { recursive: true })
  for (const slot of SLOTS) {
    const from = path.join(BRANDING, '2.0.x', ours, 'ios', slot)
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
  console.log(`${apple}: ${SLOTS.length * 8} screenshots`)
}
console.log(`\n${copied} files in ${OUT}`)
console.log('Next: cd apps/mobile && fastlane deliver')
