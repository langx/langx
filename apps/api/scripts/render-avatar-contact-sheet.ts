/**
 * Draws every v3 default face at 480, 96, 40 and 24px, one sheet per size,
 * for a person to look at before the art ships.
 *
 * The faces are composed by the same `composeSvg` the route serves, so what
 * the sheet shows is what a client gets; only the grid and labels are added
 * here. 40 and 24 use the small cut and 96 the flat one, as the app would at
 * those display sizes.
 *
 * Usage:
 *   cd apps/api && pnpm exec tsx scripts/render-avatar-contact-sheet.ts --out <dir>
 *
 * Reads nothing but `assets/avatars` and writes only files: no database, no
 * network, no env.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_AVATAR_GROUNDS, defaultAvatarCutFor } from '@langx/shared'
import { Resvg } from '@resvg/resvg-js'
import { composeSvg } from '../src/modules/avatars/compose'
import { loadAvatarLibrary } from '../src/modules/avatars/library'

const SIZES = [480, 96, 40, 24] as const
const COLUMNS = 16

function argument(name: string): string | undefined {
  const at = process.argv.indexOf(name)
  return at === -1 ? undefined : process.argv[at + 1]
}

const out = argument('--out')
if (!out) {
  console.error('Usage: tsx scripts/render-avatar-contact-sheet.ts --out <dir>')
  process.exit(1)
}

const lib = await loadAvatarLibrary()
mkdirSync(out, { recursive: true })

for (const background of ['light', 'dark'] as const) {
  for (const size of SIZES) {
    const gap = Math.max(8, Math.round(size / 6))
    const label = Math.max(11, Math.round(size / 8))
    const cellW = size + gap
    const cellH = size + gap + label + 4
    const rows = Math.ceil(lib.faces.length / COLUMNS)
    const width = COLUMNS * cellW + gap
    const height = rows * cellH + gap
    const ink = background === 'light' ? '#5a5f69' : '#a3a8b3'
    const paper = background === 'light' ? '#faf8f5' : '#0c0d10'
    const cells = lib.faces.map((face, i) => {
      const x = gap + (i % COLUMNS) * cellW
      const y = gap + Math.floor(i / COLUMNS) * cellH
      const position = Number(face.id.slice(1)) - 1
      // The sheet's own spread of grounds, so neighbours differ.
      const ground = (DEFAULT_AVATAR_GROUNDS.length - (position % 6)) % 6
      const svg = composeSvg(lib, { face, ground, size, cut: defaultAvatarCutFor(size) })
        .replace('<svg ', `<svg x="${x}" y="${y}" `)
        .replace('id="disc"', `id="disc${i}"`)
        .replace('url(#disc)', `url(#disc${i})`)
      const text = `<text x="${x + size / 2}" y="${y + size + label + 2}" font-family="Helvetica, Arial, sans-serif" font-size="${label}" font-weight="700" fill="${ink}" text-anchor="middle">${face.id}</text>`
      return svg + text
    })
    const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="${paper}"/>${cells.join('')}</svg>`
    const png = new Resvg(sheet, { font: { loadSystemFonts: true } }).render().asPng()
    const file = join(out, `contact-${size}-${background}.png`)
    writeFileSync(file, png)
    console.log(file)
  }
}
