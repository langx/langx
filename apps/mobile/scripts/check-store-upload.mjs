#!/usr/bin/env node
/* global console, process */
/**
 * Reads a `fastlane deliver` log back and says whether the upload actually
 * landed. deliver exits 0 while dropping screenshots, so the exit code is not
 * the answer — twice on this listing it was 0 over a set that was short in
 * every language.
 *
 *   fastlane store | tee deliver.log
 *   node apps/mobile/scripts/check-store-upload.mjs deliver.log
 *
 * Two ways it goes wrong, both reported as "Too many screenshots found for
 * device" among several hundred lines of upload output:
 *
 *   - two folders that resolve to one App Store Connect slot (13" and 12.9"
 *     both land on APP_IPAD_PRO_3GEN_129), so sixteen images arrive at a
 *     ten-image slot
 *   - a retried upload counted twice, which fills the slot with duplicates and
 *     drops the tail — fixed upstream in fastlane 2.239
 */
import fs from 'node:fs'

const log = process.argv[2]
if (!log) {
  console.error('usage: check-store-upload.mjs <deliver log>')
  process.exit(1)
}
const ANSI = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g')
const text = fs.readFileSync(log, 'utf8').replace(ANSI, '')

const uploaded = new Map()
const duplicates = []
for (const m of text.matchAll(/Uploaded '\.\/fastlane\/screenshots\/([^/]+)\/([^']+)'/g)) {
  const [, locale, file] = m
  const seen = uploaded.get(locale) ?? new Set()
  if (seen.has(file)) duplicates.push(`${locale}/${file}`)
  seen.add(file)
  uploaded.set(locale, seen)
}

const skipped = [
  ...text.matchAll(/Too many screenshots found for device '([^']+)' in '([^']+)'[^(]*\(([^)]+)\)/g),
].map((m) => ({ device: m[1], locale: m[2], file: m[3] }))

const expected = Number(process.env.SHOTS_PER_LOCALE ?? 24)
let bad = false
for (const [locale, files] of [...uploaded].sort()) {
  const ok = files.size === expected
  if (!ok) bad = true
  console.log(`${ok ? 'ok   ' : 'SHORT'} ${locale.padEnd(6)} ${files.size}/${expected}`)
}
if (duplicates.length) {
  bad = true
  console.log(`\n${duplicates.length} uploaded twice (fastlane before 2.239 retries):`)
  for (const d of duplicates) console.log(`  ${d}`)
}
if (skipped.length) {
  bad = true
  console.log(`\n${skipped.length} skipped by App Store Connect:`)
  for (const s of skipped) console.log(`  ${s.locale} ${s.device} ${s.file}`)
}
if (bad) {
  console.log(
    '\nRe-run `fastlane store skip_metadata:true` - overwrite_screenshots clears the slots first.',
  )
  process.exit(1)
}
console.log(`\nAll ${uploaded.size} locales complete.`)
