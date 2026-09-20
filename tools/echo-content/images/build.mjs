/**
 * Turns the cue tables into the pictures the packs point at.
 *
 * Three files, and each one answers a different question:
 *
 * - `cues.<lang>.json` — which concept is the cue for which phrase, one file
 *   per pack language because the key is the phrase and a phrase is in a
 *   language. The editorial half, one line each, and the only half worth
 *   reviewing. The concept is written as an emoji because an emoji is a name
 *   everyone already reads: `"I'm broke.": "💸"` needs no key, where
 *   `"I'm broke.": "money-with-wings"` needs one. Nothing ships the emoji
 *   character, and the slugs are shared: one picture serves every language
 *   that points a phrase at it.
 * - `concepts.json` — what each of those emoji is called. A frozen table, so
 *   the slug a cue resolves to cannot drift under it, and the manifest
 *   `packContent.test.ts` checks the packs against.
 * - `drawings.mjs` — the shapes. One entry per slug, all of them.
 *
 * **Nothing here reaches the network and nothing is borrowed.** Every picture
 * is drawn for this app, to `ILLUSTRATION.md`. It was not always so: most of
 * these began as OpenMoji glyphs placed on our plate, and `concepts.json` is
 * what remains of that — a naming table, not their artwork.
 *
 * **What comes out is PNG, and that is deliberate.** Vector would be a tenth
 * of the bytes and crisp at any size, and it is still the wrong file to ship:
 * expo-image decodes SVG with each platform's own decoder, and iOS's
 * mishandles elliptical-arc commands whose flags are packed. Expo documents
 * the failure and suggests a second renderer for the screens that need one. A
 * flat PNG has no decoder to disagree about: iOS, Android and the web draw the
 * same bytes.
 *
 * The plate is baked in rather than drawn by the app, for a related reason: a
 * card's picture is one URL with no theme to it, and every drawing here is
 * bounded by a dark ink contour. Unplated on a dark background the contour
 * goes and the picture with it. One light plate inside the file is correct in
 * both themes.
 *
 * **Nothing rendered is committed.** The PNGs go to `out/`, which is ignored,
 * and from there to the bucket — the same shape as the synthesised readings
 * next door. Twelve megabytes of regenerable binary in a public repository
 * buys nothing that one command does not give back.
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
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { DRAWINGS } from './drawings.mjs'
import { writePack } from '../writePack.mjs'

const HERE = import.meta.dirname
const OUT = resolve(HERE, 'out')
const CONTENT = resolve(HERE, '../../../content/echo')

/** The cue table for each language that has packs, keyed by phrase. */
async function cuesByLang() {
  const found = new Map()
  for (const entry of await readdir(CONTENT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const path = join(HERE, `cues.${entry.name}.json`)
    // A language with packs and no cue file yet is a language mid-draft, not
    // an error: the cards simply carry no picture until somebody writes one.
    const table = await readFile(path, 'utf8').catch(() => null)
    found.set(entry.name, table ? JSON.parse(table) : {})
  }
  return found
}

/** The plate every picture sits on. See the note above, and ILLUSTRATION.md. */
const PLATE = { width: 400, height: 300, radius: 28, fill: '#f4f5f7' }
/**
 * Three times the plate.
 *
 * The card draws the picture at up to 240pt on a screen that is 3× on every
 * phone worth worrying about, so 1200×900 is the last size that buys anything.
 * Larger is bytes nobody sees.
 */
const RENDER = { width: PLATE.width * 3, height: PLATE.height * 3 }

/** U+FE0F, the variation selector. `⏱` and `⏱️` are the same cue. */
const stripVariation = (text) => text.replace(/\uFE0F/g, '')

/** The drawing, as the renderer is handed it. Never written to disk. */
function scene({ label, body }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PLATE.width} ${PLATE.height}" width="${PLATE.width}" height="${PLATE.height}" role="img" aria-label="${label}">
  <rect width="${PLATE.width}" height="${PLATE.height}" rx="${PLATE.radius}" fill="${PLATE.fill}"/>
  <g stroke="#17191c" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">${body}
  </g>
</svg>
`
}

/**
 * `spawn` and not `execFile`, because the SVG goes in on stdin and `execFile`
 * has no way to put it there — its `input` option belongs to `execFileSync`,
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
      reject(new Error('rsvg-convert is not installed (brew install librsvg)', { cause })),
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

async function main() {
  const apply = process.argv.includes('--apply')
  const cues = await cuesByLang()
  const concepts = JSON.parse(await readFile(join(HERE, 'concepts.json'), 'utf8'))
  const slugOf = new Map(
    Object.entries(concepts).map(([emoji, slug]) => [stripVariation(emoji), slug]),
  )

  /** slug → how many phrases point at it, and, per language, phrase → slug. */
  const used = new Map()
  const bySlug = new Map()
  const unknown = []
  let cards = 0
  for (const [lang, table] of cues) {
    const forLang = new Map()
    bySlug.set(lang, forLang)
    for (const [phrase, emoji] of Object.entries(table)) {
      cards += 1
      const slug = slugOf.get(stripVariation(emoji))
      if (!slug) {
        unknown.push(`${lang}: ${phrase} → ${emoji}`)
        continue
      }
      used.set(slug, (used.get(slug) ?? 0) + 1)
      forLang.set(phrase, slug)
    }
  }

  /*
   * Three ways the three files can disagree, each of them a silent failure
   * otherwise: a cue nothing can resolve, a slug nothing has drawn, and a
   * drawing nothing points at. The first two are a blank card; the third is a
   * rename that only reached one file.
   */
  const undrawn = [...used.keys()].filter((slug) => !DRAWINGS[slug])
  const stray = Object.keys(DRAWINGS).filter((slug) => !used.has(slug))
  for (const [what, list] of [
    ['cue(s) name an emoji concepts.json does not know', unknown],
    ['cue(s) name a slug drawings.mjs has not drawn', undrawn],
    ['drawing(s) no cue points at', stray],
  ]) {
    if (list.length === 0) continue
    console.error(`${list.length} ${what}: ${list.join(', ')}`)
    process.exitCode = 1
  }
  if (process.exitCode) return

  let bytes = 0
  if (apply) {
    await mkdir(OUT, { recursive: true })
    for (const slug of [...used.keys()].sort()) {
      bytes += await renderPng(scene(DRAWINGS[slug]), join(OUT, `${slug}.png`))
    }
  }

  /*
   * And then the packs themselves, because the cue table is the source and the
   * `image` field is derived from it. Writing it by hand in three files of
   * eight hundred items is how the two drift.
   *
   * `contentVersion` goes up when, and only when, an item's cue actually
   * changed. That field's whole job is to say which draft of the content a
   * seeded row came from; a run that rewrote nothing must not claim a new
   * draft, and a run that rewrote something must not keep the old number.
   */
  for (const [lang, forLang] of bySlug) {
    for (const file of (await readdir(join(CONTENT, lang))).filter((name) =>
      name.endsWith('.json'),
    )) {
      const path = join(CONTENT, lang, file)
      const pack = JSON.parse(await readFile(path, 'utf8'))
      let changed = 0
      for (const item of pack.items) {
        const slug = forLang.get(item.text)
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
      if (apply) await writePack(path, pack)
    }
  }

  console.log(`${cards} cards, ${used.size} concepts, all drawn here`)
  console.log(
    apply ? `  wrote ${used.size} PNG(s), ${(bytes / 1024 / 1024).toFixed(1)} MB` : '  (dry run)',
  )
}

await main()
