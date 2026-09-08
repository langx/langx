#!/usr/bin/env node
/* global console */
/**
 * Turns docs/store/listing.md into the metadata folders `fastlane deliver`
 * reads, so a localization that does not exist yet in App Store Connect is
 * created by the upload instead of by hand.
 *
 * This is the half the screenshots cannot go up without: a locale has to have
 * a description and keywords before it will accept an image.
 *
 *   node apps/mobile/scripts/collect-store-metadata.mjs
 *   node apps/mobile/scripts/collect-store-screenshots.mjs
 *   cd apps/mobile && fastlane deliver --skip_binary_upload
 *
 * English is deliberately not written. It is already correct on the version in
 * App Store Connect, and its release notes are edited there per release —
 * generating it would overwrite the live copy with whatever this file last
 * said.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const MOBILE = path.resolve(HERE, '..')
const REPO = path.resolve(MOBILE, '../..')
const LISTING = path.join(REPO, 'docs/store/listing.md')
const OUT = path.join(MOBILE, 'fastlane/metadata')

// Section heading in listing.md to App Store Connect locale. English is absent
// on purpose, see the note above.
const LOCALES = {
  Türkçe: 'tr',
  'Español (es-ES)': 'es-ES',
  'Русский (ru)': 'ru',
  'العربية (ar-SA)': 'ar-SA',
  'Français (fr-FR)': 'fr-FR',
  'Deutsch (de-DE)': 'de-DE',
  'Português do Brasil (pt-BR)': 'pt-BR',
}

// The bold label each language's release notes sit under, in the What's new
// section. Not the same strings as the headings above — those carry the locale
// code, these do not.
const NOTES_LABEL = {
  tr: 'Türkçe',
  'es-ES': 'Español',
  ru: 'Русский',
  'ar-SA': 'العربية',
  'fr-FR': 'Français',
  'de-DE': 'Deutsch',
  'pt-BR': 'Português do Brasil',
}

// Same for every locale; read back from the live version rather than invented.
const URLS = {
  'support_url.txt': 'https://langx.io/#contact-us',
  'marketing_url.txt': 'https://langx.io',
  'privacy_url.txt': 'https://langx.io/privacy-policy',
}

const md = fs.readFileSync(LISTING, 'utf8')

/**
 * The `> ` block that follows a heading, unquoted. Line breaks are kept as
 * they are written: listing.md is line-for-line what the store shows, so the
 * Terms of Use footer stays three lines and the release notes stay a list.
 */
function blockquoteAfter(text, from) {
  const out = []
  let started = false
  for (const line of text.slice(from).split('\n')) {
    if (line.startsWith('> ')) {
      started = true
      out.push(line.slice(2))
    } else if (line === '>') {
      started = true
      out.push('')
    } else if (started) break
  }
  return out.join('\n').replace(/\*\*/g, '').trim()
}

/** Section body between one `## ` heading and the next. */
function section(name) {
  const start = md.indexOf(`\n## ${name}\n`)
  if (start < 0) throw new Error(`No section "${name}" in ${LISTING}`)
  const next = md.indexOf('\n## ', start + 1)
  return md.slice(start, next < 0 ? md.length : next)
}

/** Backticked values in a section, in file order: name, subtitle, play, keywords. */
function backticks(body) {
  return [...body.matchAll(/^`([^`]+)`$/gm)].map((m) => m[1])
}

const notesSection = section("What's new (release notes)")

fs.rmSync(OUT, { recursive: true, force: true })
let written = 0
for (const [heading, locale] of Object.entries(LOCALES)) {
  const body = section(heading)
  const [name, subtitle, , keywords] = backticks(body)
  if (!name || !subtitle || !keywords) {
    console.error(`${locale}: expected name, subtitle and keywords in "${heading}"`)
    process.exit(1)
  }

  const descHeading = body.search(/^\*\*[^*]*\*\*\n\n> /m)
  const description = blockquoteAfter(body, body.indexOf('\n> ', descHeading))

  const label = `**${NOTES_LABEL[locale]}**`
  const at = notesSection.indexOf(label)
  if (at < 0) {
    console.error(`${locale}: no release notes under ${label}`)
    process.exit(1)
  }
  const releaseNotes = blockquoteAfter(notesSection, at)

  const dir = path.join(OUT, locale)
  fs.mkdirSync(dir, { recursive: true })
  const files = {
    'name.txt': name,
    'subtitle.txt': subtitle,
    'keywords.txt': keywords,
    'description.txt': description,
    'release_notes.txt': releaseNotes,
    ...URLS,
  }
  for (const [file, value] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, file), `${value}\n`)
    written++
  }

  // The two limits App Store Connect rejects on, checked here so a bad value
  // fails locally rather than half way through an upload.
  for (const [what, value, max] of [
    ['name', name, 30],
    ['subtitle', subtitle, 30],
    ['keywords', keywords, 100],
  ]) {
    if ([...value].length > max) {
      console.error(`${locale}: ${what} is ${[...value].length} characters, max ${max}`)
      process.exit(1)
    }
  }
  console.log(`${locale}: ${name} · ${subtitle} · ${description.length} char description`)
}
console.log(`\n${written} files in ${OUT}`)
console.log('Next: node apps/mobile/scripts/collect-store-screenshots.mjs')
