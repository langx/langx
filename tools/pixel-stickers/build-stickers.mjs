/* global console, Buffer */
/**
 * Draws the `pixel` sticker pack from a grid of characters.
 *
 * Every sticker below is sixteen strings of sixteen characters, one character
 * per pixel, plus a palette naming the colours. That is the whole source: a
 * sticker is edited by changing a letter, and a mistake is visible in the
 * file rather than in a path's control points. Writing the same art as hand
 * authored `<rect>` elements would be several hundred lines nobody can read.
 *
 * **Sixteen by sixteen, into a 32-unit viewBox** — two units per pixel, which
 * is what keeps pixel art looking like pixel art. `expo-image` draws a sticker
 * at 112px in a message and 64px in the keyboard; against a 32-unit box those
 * are 3.5x and 2x, so a two-unit pixel lands on exactly 7px and 4px and every
 * edge falls on a device pixel. A 32x32 grid would put each pixel on 3.5px at
 * the size that matters most, and every edge would be a soft grey line.
 *
 * `shape-rendering="crispEdges"` would be the obvious belt-and-braces and is
 * deliberately not here: the grid already lands square, and Android decodes
 * these through `androidsvg`, whose support for it is not something
 * `docs/data-sources.md` lets us assume.
 *
 * Output is committed, like the other two packs. Nothing runs this at build
 * time.
 *
 * Usage:
 *   node tools/pixel-stickers/build-stickers.mjs
 *   node tools/pixel-stickers/build-stickers.mjs --preview <dir>
 *
 * `--preview` also writes a contact sheet there, drawn at the three sizes the
 * app uses. Whether a symbol reads at sixteen pixels is a question only
 * looking at it answers.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(HERE, '..', '..', 'apps', 'mobile', 'assets', 'stickers', 'pixel')

/**
 * The ink, and the app's own colours.
 *
 * Taken from `apps/mobile/src/lib/theme/tokens.ts` and from what the other two
 * packs already use — `#17191c` is the ink every sticker we drew is outlined
 * in. A sticker sits on the chat background with no bubble behind it, so each
 * one is given a coloured body rather than relying on the outline: in dark
 * mode the ink is very nearly the background, and a shape drawn only in
 * outline would disappear.
 */
const INK = '#17191c'
const PALETTE = {
  k: INK,
  w: '#ffffff',
  s: '#9aa1a7',
  y: '#ffc409',
  o: '#e0ac08',
  f: '#f79009',
  b: '#3b6cf6',
  l: '#7c9cf9',
  g: '#009f70',
  m: '#34c796',
  r: '#e5484d',
  p: '#7a5af8',
}

/**
 * The pack: twelve symbols in the language of an 8-bit game.
 *
 * None of them repeats a meaning the other two packs already carry, and none
 * of them says anything in words — the rule in `docs/data-sources.md`, which
 * is why a level-up is an arrow and not the two words.
 */
const STICKERS = {
  /** A coin: "that was good", a small reward. */
  coin: [
    '.....kkkkkk.....',
    '...kkyyyyyykk...',
    '..kyyyyyyyyyyk..',
    '.kyyyyyyyyyyyyk.',
    '.kyyyyyyyyyyyyk.',
    'kyyyyyooooyyyyyk',
    'kyyyyoyyyyoyyyyk',
    'kyyyyoyyyyoyyyyk',
    'kyyyyoyyyyoyyyyk',
    'kyyyyoyyyyoyyyyk',
    'kyyyyyooooyyyyyk',
    '.kyyyyyyyyyyyyk.',
    '.kooooooooooook.',
    '..kooooooooook..',
    '...kkooooookk...',
    '.....kkkkkk.....',
  ],
  /** A shield: "no harm done", said about somebody else's mistake. */
  shield: [
    '..kkkkkkkkkkkk..',
    '.kbbbbbbbbbbbbk.',
    '.kbllbbbbbbbbbk.',
    '.kbllbbbbbbbbbk.',
    '.kbllbbbbbbbbbk.',
    '.kbbbbbbbbbbbbk.',
    '.kbbbbbbbbbbbbk.',
    '.kbbbbbbbbbbbbk.',
    '..kbbbbbbbbbbk..',
    '..kbbbbbbbbbbk..',
    '...kbbbbbbbbk...',
    '....kbbbbbbk....',
    '.....kbbbbk.....',
    '......kbbk......',
    '.......kk.......',
    '................',
  ],
  /** An arrow up: "I got better at this". */
  levelup: [
    '.......kk.......',
    '......kggk......',
    '.....kggggk.....',
    '....kggggggk....',
    '...kggggggggk...',
    '..kggggggggggk..',
    '..kkkkggggkkkk..',
    '.....kggggk.....',
    '.....kggggk.....',
    '.....kggggk.....',
    '.....kggggk.....',
    '.....kggggk.....',
    '.....kggggk.....',
    '.....kggggk.....',
    '.....kkkkkk.....',
    '................',
  ],
  /** A flag on a pole: "we got this far". */
  checkpoint: [
    '....kkkkkkkkkkk.',
    '....kskbbbbbbbk.',
    '....kskblllbbbk.',
    '....kskbbbbbbbk.',
    '....kskbbbbbbbk.',
    '....kskbbbbbbbk.',
    '....kskkkkkkkkk.',
    '....ksk.........',
    '....ksk.........',
    '....ksk.........',
    '....ksk.........',
    '....ksk.........',
    '....ksk.........',
    '....ksk.........',
    '...ksssk........',
    '...kkkkk........',
  ],
  /** A floppy disk: "noted, I will remember that". */
  save: [
    '................',
    '.kkkkkkkkkkkkkk.',
    '.kbbbkkkkkkbbbk.',
    '.kbbbksssskbbbk.',
    '.kbbbksssskbbbk.',
    '.kbbbksssskbbbk.',
    '.kbbbkkkkkkbbbk.',
    '.kbbbbbbbbbbbbk.',
    '.kbbbbbbbbbbbbk.',
    '.kbkkkkkkkkkkbk.',
    '.kbkwwwwwwwwkbk.',
    '.kbkwwwwwwwwkbk.',
    '.kbkwwwwwwwwkbk.',
    '.kbkwwwwwwwwkbk.',
    '.kkkkkkkkkkkkkk.',
    '................',
  ],
  /** A key: "now I understand it". */
  key: [
    '.....kkkkkk.....',
    '....kkyyyykk....',
    '....kyykkyyk....',
    '....kyykkyyk....',
    '....kkyyyykk....',
    '.....kkyykk.....',
    '......kyyk......',
    '......kyyk......',
    '......kyyk......',
    '......kyyk......',
    '......kyyyyyk...',
    '......kyykkkk...',
    '......kyyyk.....',
    '......kyykk.....',
    '......kkkk......',
    '................',
  ],
  /** A flask: "that gave me energy". */
  potion: [
    '................',
    '......kkkk......',
    '......kook......',
    '......kkkk......',
    '......kwwk......',
    '.....kwwwwk.....',
    '....kwwwwwwk....',
    '...kwwwwwwwwk...',
    '..kwwwwwwwwwwk..',
    '..kppppppppppk..',
    '..kpwppppppppk..',
    '..kppppppppppk..',
    '..kppppppppppk..',
    '...kppppppppk...',
    '....kkkkkkkk....',
    '................',
  ],
  /** A gamepad: "your turn". */
  controller: [
    '................',
    '................',
    '................',
    '................',
    '..kkkkkkkkkkkk..',
    '.kssssssssssssk.',
    '.kssksssssssssk.',
    '.kskkkssssrsysk.',
    '.kssksssssssssk.',
    '.kssssssssssssk.',
    '.kssssssssssssk.',
    '..kkkkkkkkkkkk..',
    '................',
    '................',
    '................',
    '................',
  ],
  /** A ghost: "sorry I disappeared". */
  ghost: [
    '................',
    '....kkkkkkkk....',
    '..kkwwwwwwwwkk..',
    '.kwwwwwwwwwwwwk.',
    '.kwwkkwwwwkkwwk.',
    '.kwwkkwwwwkkwwk.',
    '.kwwwwwwwwwwwwk.',
    '.kwwwwwwwwwwwwk.',
    '.kwwwwwwwwwwwwk.',
    '.kwwwwwwwwwwwwk.',
    '.kwwwwwwwwwwwwk.',
    '.kwwwwwwwwwwwwk.',
    '.kwwwwwwwwwwwwk.',
    '.kwwwwwwwwwwwwk.',
    '.kwwkkwwkkwwkkk.',
    '..kk..kk..kk....',
  ],
  /** A blob: "this one is hard". */
  slime: [
    '................',
    '................',
    '................',
    '................',
    '......kkkk......',
    '....kkmmmmkk....',
    '...kmmmmmmmmk...',
    '..kmmkkmmkkmmk..',
    '..kmmkkmmkkmmk..',
    '.kmmmmmmmmmmmmk.',
    '.kmmmmkkkkmmmmk.',
    '.kmmmmmmmmmmmmk.',
    'kmmmmmmmmmmmmmmk',
    'kggggggggggggggk',
    'kkkkkkkkkkkkkkkk',
    '................',
  ],
  /** A flame: "we are on a roll". */
  flame: [
    '.......kk.......',
    '......kffk......',
    '......kffk......',
    '.....kffffk.....',
    '.....kffffk.....',
    '....kffffffk....',
    '...kffffffffk...',
    '..kfffyyyyfffk..',
    '..kffyyyyyyffk..',
    '..kffyyyyyyffk..',
    '..kffyyyyyyffk..',
    '..kfffyyyyfffk..',
    '...kffffffffk...',
    '....kffffffk....',
    '.....kkkkkk.....',
    '................',
  ],
  /**
   * A thumb up.
   *
   * White with an ink outline, for the reason `docs/data-sources.md` gives:
   * Fluent's thumb ships in six skin tones and no neutral one, and picking a
   * default for a global language exchange is a decision with no right
   * answer. Drawn this way it reads as a glyph rather than as anybody's hand.
   */
  thumb: [
    '................',
    '......kk........',
    '.....kwwk.......',
    '.....kwwk.......',
    '.....kwwk.......',
    '.....kwwkkkkk...',
    '..kkkkwwwwwwwk..',
    '.kwwwwwwwwwwwwk.',
    '.kwwwwkkkkkkwwk.',
    '.kwwwwwwwwwwwwk.',
    '.kwwwwkkkkkkwwk.',
    '.kwwwwwwwwwwwwk.',
    '.kwwwwkkkkkkwwk.',
    '.kwwwwwwwwwwwwk.',
    '.kkkkkkkkkkkkkk.',
    '................',
  ],
}

const GRID = 16
/** Two viewBox units per pixel. See the note at the top of this file. */
const UNIT = 2

/** Refuses a grid that is not square, or that names a colour the palette has not. */
function check(id, rows) {
  if (rows.length !== GRID) throw new Error(`${id}: ${rows.length} rows, expected ${GRID}`)
  rows.forEach((row, y) => {
    if (row.length !== GRID) throw new Error(`${id}: row ${y} is ${row.length} wide`)
    for (const char of row) {
      if (char !== '.' && !(char in PALETTE)) throw new Error(`${id}: row ${y} uses '${char}'`)
    }
  })
}

/**
 * One `<rect>` per run of same-coloured pixels along a row.
 *
 * A rect per pixel would be 256 of them and about 14KB; the other packs are
 * 4-5KB each and a sticker is not worth three times a hand-drawn one. Runs
 * get it back: most rows are a handful of spans.
 */
function toSvg(rows) {
  const rects = []
  rows.forEach((row, y) => {
    let x = 0
    while (x < GRID) {
      const char = row[x]
      let end = x
      while (end + 1 < GRID && row[end + 1] === char) end++
      const run = end - x + 1
      if (char !== '.') {
        rects.push(
          `<rect x="${x * UNIT}" y="${y * UNIT}" width="${run * UNIT}" height="${UNIT}" fill="${PALETTE[char]}"/>`,
        )
      }
      x = end + 1
    }
  })
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">\n` +
    rects.map((rect) => `  ${rect}`).join('\n') +
    `\n</svg>\n`
  )
}

/** A contact sheet at the three sizes the app draws a sticker at. */
function previewHtml(drawn) {
  const cells = Object.entries(drawn)
    .map(
      ([id, svg]) =>
        `<figure><div class="row">` +
        [112, 64, 30]
          .map(
            (size) =>
              `<img width="${size}" height="${size}" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" alt="${id}">`,
          )
          .join('') +
        `</div><figcaption>${id}</figcaption></figure>`,
    )
    .join('\n')
  return `<!doctype html><meta charset="utf-8"><title>pixel stickers</title>
<style>
  body { font: 13px system-ui; margin: 0; display: grid; grid-template-columns: 1fr 1fr; }
  section { padding: 24px; }
  .light { background: #ffffff; color: #17191c; }
  .dark { background: #1c1f24; color: #f2f3f5; }
  figure { margin: 0 0 20px; }
  .row { display: flex; align-items: flex-end; gap: 12px; }
  figcaption { margin-top: 4px; opacity: .7; }
</style>
<section class="light">${cells}</section>
<section class="dark">${cells}</section>`
}

async function main() {
  const drawn = {}
  for (const [id, rows] of Object.entries(STICKERS)) {
    check(id, rows)
    drawn[id] = toSvg(rows)
  }

  await mkdir(OUT_DIR, { recursive: true })
  for (const [id, svg] of Object.entries(drawn)) {
    await writeFile(join(OUT_DIR, `${id}.svg`), svg, 'utf8')
  }
  console.log(`${Object.keys(drawn).length} stickers → ${OUT_DIR}`)

  const flag = process.argv.indexOf('--preview')
  if (flag !== -1) {
    const target = process.argv[flag + 1]
    if (!target) throw new Error('--preview needs a directory')
    await mkdir(target, { recursive: true })
    const page = join(target, 'pixel-stickers.html')
    await writeFile(page, previewHtml(drawn), 'utf8')
    console.log(`preview → ${page}`)
  }
}

await main()
