/**
 * Turns `cues.json` into the pictures the packs point at.
 *
 * `cues.json` is the editorial half and the only half worth reviewing: one
 * line per phrase, saying which *concept* is the cue for it. The concept is
 * written as an emoji because an emoji is a name everyone already reads —
 * `"I'm broke.": "💸"` needs no key to understand, where `"I'm broke.":
 * "money-with-wings"` needs one. Nothing ships the emoji character; it is
 * resolved here to a slug, and the slug is what the content and the bucket
 * use.
 *
 * Two kinds of picture go in, in one directory and one namespace:
 *
 * - **Ours**, from `drawings.mjs`, drawn to `ILLUSTRATION.md`.
 * - **Everything else**: an OpenMoji glyph (CC BY-SA 4.0) placed on the same
 *   plate at the same size, so a deck of eight hundred cards reads as one set
 *   rather than as two.
 *
 * **What comes out is PNG, and that is deliberate.** Vector would be a tenth
 * of the bytes and crisp at any size, and it is still the wrong file to ship:
 * expo-image decodes SVG with each platform's own decoder, and iOS's
 * mishandles elliptical-arc commands whose flags are packed — the form every
 * minifier emits, and so the form most of OpenMoji is written in. Expo
 * documents the failure and suggests a second renderer for the screens that
 * need one. A flat PNG has no decoder to disagree about: iOS, Android and the
 * web draw the same bytes. One format, no caveat, no second renderer on the
 * card screen.
 *
 * The plate is baked in rather than drawn by the app, for a related reason: a
 * card's picture is one URL with no theme to it, and every drawing here is
 * bounded by a dark ink contour. Unplated on a dark background the contour
 * goes and the picture with it. One light plate inside the file is correct in
 * both themes.
 *
 * **Nothing it renders is committed.** The PNGs go to `out/`, which is
 * ignored, and from there to the bucket — the same shape as the synthesised
 * readings next door. What the repository keeps is what a person wrote:
 * `cues.json`, `drawings.mjs`, and `credits.json` as the record of which
 * glyphs were borrowed. Committing the pictures would put twelve megabytes of
 * regenerable binary in a public repository to save one command.
 *
 * Needs `rsvg-convert` (`brew install librsvg`), the way the readings need
 * python — this runs by hand when the content changes, never in CI.
 *
 * Usage:
 *   node tools/echo-content/images/build.mjs            # report, write nothing
 *   node tools/echo-content/images/build.mjs --apply
 */
import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import prettier from 'prettier'
import { DRAWINGS } from './drawings.mjs'

const HERE = import.meta.dirname
const OUT = resolve(HERE, 'out')
const OPENMOJI_VERSION = '15.1.0'
const DATA_URL = `https://cdn.jsdelivr.net/npm/openmoji@${OPENMOJI_VERSION}/data/openmoji.json`
const SVG_URL = (hex) =>
  `https://cdn.jsdelivr.net/npm/openmoji@${OPENMOJI_VERSION}/color/svg/${hex}.svg`

/** The plate every picture sits on. See the note above, and ILLUSTRATION.md. */
const PLATE = { width: 400, height: 300, radius: 28, fill: '#f4f5f7' }
/** How much of the plate a borrowed glyph takes. Our own drawings compose
 *  their own space; a glyph is one object and wants air around it. */
const GLYPH = 208
/**
 * Three times the plate.
 *
 * The card draws the picture at up to 240pt on a screen that is 3× on every
 * phone worth worrying about, so 1200×900 is the last size that buys anything.
 * Larger is bytes nobody sees.
 */
const RENDER = { width: PLATE.width * 3, height: PLATE.height * 3 }

/** `crying face` → `crying-face`, and stable enough to be a filename. */
function slugify(annotation) {
  return annotation
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** U+FE0F, the variation selector. `⏱` and `⏱️` are the same cue. */
const stripVariation = (text) => text.replace(/\uFE0F/g, '')

/**
 * Fetched, never cached to disk.
 *
 * There was a disk cache here and it earned its removal twice over. CodeQL
 * objects to writing a network response to a file and is right to — the
 * pattern is worth a second look wherever it appears, and a build tool is not
 * where you want to be arguing the exception. The version is pinned, so
 * jsDelivr serves immutable bytes and the only cost of dropping the cache is
 * a few hundred kilobytes on a run that already spends a minute rendering.
 *
 * What it buys back: no cache directory, no ignore entries for it, and no
 * question about whether a stale file is why a picture changed.
 */
async function fetchText(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: ${response.status}`)
  return await response.text()
}

async function openmojiTable() {
  const rows = JSON.parse(await fetchText(DATA_URL))
  const byEmoji = new Map()
  for (const row of rows) byEmoji.set(stripVariation(row.emoji), row)
  return byEmoji
}

async function glyphBody(hex) {
  const raw = await fetchText(SVG_URL(hex))
  /*
   * The glyph's own 72×72 box is thrown away and its children are re-placed on
   * ours. Keeping the nested <svg> would work in some renderers and not
   * others; a <g> with a transform works everywhere.
   */
  const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
  const scale = GLYPH / 72
  const dx = (PLATE.width - GLYPH) / 2
  const dy = (PLATE.height - GLYPH) / 2
  return `  <g transform="translate(${dx} ${dy}) scale(${scale.toFixed(4)})">\n${inner.trim()}\n  </g>`
}

/** The drawing, as the renderer is handed it. Never written to disk. */
function scene(body, { label, ink }) {
  const subject = ink
    ? `  <g stroke="#17191c" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">\n${body}\n  </g>`
    : body
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PLATE.width} ${PLATE.height}" width="${PLATE.width}" height="${PLATE.height}" role="img" aria-label="${label}">
  <rect width="${PLATE.width}" height="${PLATE.height}" rx="${PLATE.radius}" fill="${PLATE.fill}"/>
${subject}
</svg>
`
}

/**
 * `spawn` and not `execFile`, because the SVG goes in on stdin and `execFile`
 * has no way to put it there — its `input` option is a `execFileSync` option,
 * and passing it to the async form is silently ignored, so rsvg-convert waits
 * on a stdin that never closes and the build hangs with no error at all.
 */
function renderPng(svg, path) {
  return new Promise((resolve_, reject) => {
    const child = spawn('rsvg-convert', [
      '-w',
      String(RENDER.width),
      '-h',
      String(RENDER.height),
      '-f',
      'png',
    ])
    const chunks = []
    let stderr = ''
    child.stdout.on('data', (chunk) => chunks.push(chunk))
    child.stderr.on('data', (chunk) => (stderr += chunk))
    child.on('error', (cause) =>
      reject(new Error(`rsvg-convert is not installed (brew install librsvg)`, { cause })),
    )
    child.on('close', async (code) => {
      if (code !== 0) return reject(new Error(`rsvg-convert exited ${code} for ${path}: ${stderr}`))
      const png = Buffer.concat(chunks)
      if (png.length === 0) return reject(new Error(`rsvg-convert produced nothing for ${path}`))
      await writeFile(path, png)
      resolve_(png.length)
    })
    child.stdin.end(svg)
  })
}

/**
 * Written the way `pnpm format` would write it, rather than the way
 * `JSON.stringify` does.
 *
 * The two disagree about short arrays — prettier puts `["ru"]` on one line and
 * `JSON.stringify` takes three — so a file this script wrote would fail
 * `format:check` until somebody ran the formatter, and running the formatter
 * would then show up as a diff in the next build. Formatting here ends that
 * loop: what comes out is already what CI asks for.
 */
async function writeJson(path, value) {
  const config = await prettier.resolveConfig(path)
  await writeFile(path, await prettier.format(JSON.stringify(value), { ...config, filepath: path }))
}

async function main() {
  const apply = process.argv.includes('--apply')
  const cues = JSON.parse(await readFile(join(HERE, 'cues.json'), 'utf8'))
  const table = await openmojiTable()

  /** slug → { hex, annotation, phrases } */
  const concepts = new Map()
  const unknown = []
  for (const [phrase, emoji] of Object.entries(cues)) {
    const row = table.get(stripVariation(emoji))
    if (!row) {
      unknown.push(`${phrase} → ${emoji}`)
      continue
    }
    const slug = slugify(row.annotation)
    const concept = concepts.get(slug) ?? {
      hex: row.hexcode,
      annotation: row.annotation,
      phrases: [],
    }
    concept.phrases.push(phrase)
    concepts.set(slug, concept)
  }

  if (unknown.length > 0) {
    console.error(`${unknown.length} cue(s) are not OpenMoji:`)
    for (const line of unknown) console.error(`  ${line}`)
    process.exitCode = 1
    return
  }

  /*
   * A drawing whose slug no cue uses is a rename that did not reach
   * `cues.json`, and it would otherwise sit in the tool being quietly ignored.
   */
  const stray = Object.keys(DRAWINGS).filter((slug) => !concepts.has(slug))
  if (stray.length > 0) {
    console.error(`${stray.length} drawing(s) no cue points at: ${stray.join(', ')}`)
    process.exitCode = 1
    return
  }

  const credits = { openmojiVersion: OPENMOJI_VERSION, langx: [], openmoji: [] }
  let bytes = 0
  await mkdir(OUT, { recursive: true })
  for (const [slug, concept] of [...concepts].sort(([a], [b]) => a.localeCompare(b))) {
    const own = DRAWINGS[slug]
    if (own) credits.langx.push(slug)
    else credits.openmoji.push({ slug, hexcode: concept.hex, annotation: concept.annotation })
    if (!apply) continue
    const svg = own
      ? scene(own.body, { label: own.label, ink: true })
      : scene(await glyphBody(concept.hex), { label: concept.annotation, ink: false })
    bytes += await renderPng(svg, join(OUT, `${slug}.png`))
  }

  if (apply) await writeJson(join(HERE, 'credits.json'), credits)

  /*
   * And then the packs themselves, because `cues.json` is the source and the
   * `image` field is derived from it. Writing it by hand in three files of
   * eight hundred items is how the two drift.
   *
   * `contentVersion` goes up when, and only when, an item's cue actually
   * changed. That field's whole job is to say which draft of the content a
   * seeded row came from; a run that rewrote nothing must not claim a new
   * draft, and a run that rewrote something must not keep the old number.
   */
  const bySlug = new Map()
  for (const [slug, concept] of concepts) {
    for (const phrase of concept.phrases) bySlug.set(phrase, slug)
  }
  for (const level of ['absoluteBeginner', 'beginner', 'intermediate']) {
    const path = resolve(HERE, `../../../content/echo/en/${level}.json`)
    const pack = JSON.parse(await readFile(path, 'utf8'))
    let changed = 0
    for (const item of pack.items) {
      const slug = bySlug.get(item.text)
      const next = slug ? `cue:${slug}` : undefined
      if (item.image === next) continue
      changed += 1
      if (next) item.image = next
      else delete item.image
    }
    if (changed === 0) {
      console.log(`  ${pack.id}: cues unchanged`)
      continue
    }
    pack.contentVersion += 1
    console.log(`  ${pack.id}: ${changed} cue(s) changed → contentVersion ${pack.contentVersion}`)
    if (apply) await writeJson(path, pack)
  }

  const cards = Object.values(cues).length
  const byOurs = credits.langx.reduce(
    (sum, slug) => sum + (concepts.get(slug)?.phrases.length ?? 0),
    0,
  )
  console.log(`${cards} cards, ${concepts.size} concepts`)
  console.log(
    `  ours      ${credits.langx.length} concepts → ${byOurs} cards (${Math.round((byOurs / cards) * 100)}%)`,
  )
  console.log(`  openmoji  ${credits.openmoji.length} concepts → ${cards - byOurs} cards`)
  console.log(
    apply
      ? `  wrote ${concepts.size} PNG(s), ${(bytes / 1024 / 1024).toFixed(1)} MB`
      : '  (dry run)',
  )
}

await main()
