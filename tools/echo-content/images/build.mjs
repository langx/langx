/**
 * Turns `cues.json` into the pictures the packs point at.
 *
 * Three files, and each one answers a different question:
 *
 * - `cues.json` — which concept is the cue for which phrase. The editorial
 *   half, one line each, and the only half worth reviewing. The concept is
 *   written as an emoji because an emoji is a name everyone already reads:
 *   `"I'm broke.": "💸"` needs no key, where `"I'm broke.":
 *   "money-with-wings"` needs one. Nothing ships the emoji character.
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
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import prettier from 'prettier'
import { DRAWINGS } from './drawings.mjs'

const HERE = import.meta.dirname
const OUT = resolve(HERE, 'out')

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
  const concepts = JSON.parse(await readFile(join(HERE, 'concepts.json'), 'utf8'))
  const slugOf = new Map(
    Object.entries(concepts).map(([emoji, slug]) => [stripVariation(emoji), slug]),
  )

  /** slug → the phrases that point at it. */
  const used = new Map()
  const unknown = []
  for (const [phrase, emoji] of Object.entries(cues)) {
    const slug = slugOf.get(stripVariation(emoji))
    if (!slug) {
      unknown.push(`${phrase} → ${emoji}`)
      continue
    }
    used.set(slug, [...(used.get(slug) ?? []), phrase])
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
  for (const [slug, phrases] of used) for (const phrase of phrases) bySlug.set(phrase, slug)
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

  console.log(`${Object.keys(cues).length} cards, ${used.size} concepts, all drawn here`)
  console.log(
    apply ? `  wrote ${used.size} PNG(s), ${(bytes / 1024 / 1024).toFixed(1)} MB` : '  (dry run)',
  )
}

await main()
