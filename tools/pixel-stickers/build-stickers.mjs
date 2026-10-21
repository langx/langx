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
 * **Drawn as fuse beads** (the v3 redraw). Every cell is one `<circle>`: its
 * fill is the bead's hole and a stroke around it is the bead, so a bead and
 * its hole cost one element. Under the beads sits a die-cut paper edge — one
 * stroked `<rect>` per row run, in `#f6f0e2` — and under that the same shape
 * in ink at a low opacity, offset down and right, as the drop shadow every
 * other pack has. Round strokes and circles only: no arc commands, which
 * `expo-image` on iOS draws wrongly, and no filters or gradients, which
 * `androidsvg` drops.
 *
 * **Two units per cell, in a 38-unit viewBox** (`-3 -3 38 38`): the grid
 * still spans 0–32, and the three units round it are room for the paper edge
 * and the shadow.
 *
 * Output is committed, like the other packs. Nothing runs this at build time.
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
 * Bead colours, one per letter of the grids.
 *
 * Bead primaries rather than the app's tokens, because they are meant to read
 * as plastic. A sticker sits on the chat background with no bubble behind it;
 * the paper edge is what keeps the ink beads visible in dark mode.
 */
const PALETTE = {
  k: '#1d1b22',
  w: '#ffffff',
  s: '#a9aeb5',
  y: '#ffc93c',
  o: '#e9a21b',
  f: '#ff7b22',
  b: '#2b67e0',
  l: '#86adf7',
  g: '#169c5b',
  m: '#58d197',
  r: '#e63c3c',
  p: '#8b5bd9',
}

/** A colour moved `t` of the way towards black. */
function darker(hex, t) {
  const channel = (i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - t))
  return '#' + [1, 3, 5].map((i) => channel(i).toString(16).padStart(2, '0')).join('')
}

/**
 * Each bead's hole: a third darker than the bead. Ink has nothing darker, so
 * an ink bead's hole is a lifted grey, and white's is a warm grey.
 */
const HOLE = Object.fromEntries(
  Object.entries(PALETTE).map(([char, hex]) => [
    char,
    char === 'k' ? '#4a4752' : char === 'w' ? '#d8d3c8' : darker(hex, 0.32),
  ]),
)

const EDGE = '#f6f0e2'
const SHADOW = '#0c0d10'
/** The same shadow every other pack bakes in: one opacity on the whole group. */
const SHADOW_OPACITY = '0.24'

/**
 * The pack: twelve symbols in the language of an 8-bit game.
 *
 * None of them repeats a meaning the other packs already carry, and none of
 * them says anything in words: at sixteen cells a word does not fit, which is
 * why a level-up is an arrow and not the two words.
 */
const STICKERS = {
  /**
   * An extra life: "that was good", a small reward.
   *
   * The id is still `coin`, because messages already sent store
   * `{packId, stickerId}` and must keep finding a picture. It was a gold coin
   * until the v3 redraw; a heart with a plus says "reward" without drawing
   * money in an app whose tokens are points.
   */
  coin: [
    '................',
    '.............g..',
    '............ggg.',
    '.............g..',
    '.kkk.....kkk....',
    'krrrk...krrrk...',
    'kwwrrrkrrrrrk...',
    'kwrrrrrrrrrrk...',
    'krrrrrrrrrrrk...',
    'krrrrrrrrrrrk...',
    '.krrrrrrrrrk....',
    '..krrrrrrrk.....',
    '...krrrrrk......',
    '....krrrk.......',
    '.....krk........',
    '......k.........',
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
   * any one skin tone is a default picked for a global language exchange, a
   * decision with no right answer. Drawn this way it reads as a glyph rather
   * than as anybody's hand.
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
 * The die-cut silhouette: one `<rect>` per run of filled cells along a row,
 * stroked with a round join so the runs melt into one paper shape.
 */
function silhouette(rows) {
  const rects = []
  rows.forEach((row, y) => {
    let x = 0
    while (x < GRID) {
      if (row[x] === '.') {
        x++
        continue
      }
      let end = x
      while (end + 1 < GRID && row[end + 1] !== '.') end++
      rects.push(
        `<rect x="${x * UNIT}" y="${y * UNIT}" width="${(end - x + 1) * UNIT}" height="${UNIT}"/>`,
      )
      x = end + 1
    }
  })
  return rects.join('')
}

/**
 * One `<circle>` per cell, grouped by colour: the group's fill is the hole and
 * its stroke is the bead (outer radius 0.96, hole 0.38 of a two-unit cell).
 */
function beads(rows) {
  const byColour = {}
  rows.forEach((row, y) =>
    [...row].forEach((char, x) => {
      if (char !== '.') (byColour[char] ||= []).push([x * UNIT + 1, y * UNIT + 1])
    }),
  )
  return Object.entries(byColour)
    .map(
      ([char, cells]) =>
        `  <g fill="${HOLE[char]}" stroke="${PALETTE[char]}" stroke-width=".58">` +
        cells.map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r=".67"/>`).join('') +
        `</g>`,
    )
    .join('\n')
}

function toSvg(rows) {
  const shape = silhouette(rows)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-3 -3 38 38">\n` +
    `  <g transform="translate(.5 1)" fill="${SHADOW}" stroke="${SHADOW}" stroke-width="3.4" stroke-linejoin="round" opacity="${SHADOW_OPACITY}">${shape}</g>\n` +
    `  <g fill="${EDGE}" stroke="${EDGE}" stroke-width="3.4" stroke-linejoin="round">${shape}</g>\n` +
    beads(rows) +
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
