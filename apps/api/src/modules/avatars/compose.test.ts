import { createHash } from 'node:crypto'
import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_AVATAR_POOLS } from '@langx/shared'
import { beforeAll, describe, expect, it } from 'vitest'
import { composeSvg, findFace } from './compose'
import { loadAvatarLibrary, partNames, type AvatarLibrary, type Face } from './library'
import { clearAvatarCache, renderDefaultAvatar, renderLoad } from './raster'

const PARTS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../assets/avatars/parts')

function partsOf(face: Face): string[] {
  return face.layers.flatMap((layer) =>
    'layers' in layer ? layer.layers.map((inner) => inner.part) : [layer.part],
  )
}

function digest(svg: string): string {
  return createHash('sha256').update(svg).digest('hex').slice(0, 16)
}

let lib: AvatarLibrary

beforeAll(async () => {
  lib = await loadAvatarLibrary()
})

describe('the face manifest', () => {
  it('has 48 faces in each of the three pools, numbered as on the sheet', () => {
    expect(lib.faces).toHaveLength(144)
    for (const pool of DEFAULT_AVATAR_POOLS) {
      const ids = lib.faces.filter((face) => face.pool === pool).map((face) => face.id)
      expect(ids).toEqual(
        Array.from({ length: 48 }, (_, i) => `${pool}${String(i + 1).padStart(2, '0')}`),
      )
    }
  })

  it('names only parts that exist, and every part on disk is named', () => {
    // A typo in faces.json would otherwise surface as a 500 for one face in
    // 144, the first time somebody happened to be assigned it.
    const onDisk = readdirSync(PARTS_DIR)
      .filter((file) => file.endsWith('.svg'))
      .map((file) => file.replace(/\.svg$/, ''))
      .sort()
    expect(partNames(lib.faces)).toEqual(onDisk)
  })

  it('keeps every part flat: no gradients, filters, references or scripts', () => {
    for (const [name, svg] of lib.parts) {
      expect(svg, name).not.toMatch(/<(linearGradient|radialGradient|filter|use|image|script)\b/)
      expect(svg, name).not.toMatch(/href=/)
    }
  })

  it('gives the neutral pool no beard, no earrings and no lashes', () => {
    // N is where `other`, `undisclosed` and no answer all land, so it must not
    // carry what the sheet reserves for one of the other two pools.
    for (const face of lib.faces.filter((f) => f.pool === 'N')) {
      for (const part of partsOf(face)) {
        expect(part, face.id).not.toMatch(/^p-b-|^d-stud$|^d-hoop$|^f-la$/)
      }
    }
  })

  it('draws every skin tone at least seven times in every pool', () => {
    for (const pool of DEFAULT_AVATAR_POOLS) {
      const counts = new Map<string, number>()
      for (const face of lib.faces.filter((f) => f.pool === pool)) {
        counts.set(face.skin, (counts.get(face.skin) ?? 0) + 1)
      }
      expect([...counts.keys()].sort(), pool).toEqual(['S1', 'S2', 'S3', 'S4', 'S5', 'S6'])
      for (const [skin, count] of counts) expect(count, `${pool} ${skin}`).toBeGreaterThanOrEqual(7)
    }
  })
})

describe('composeSvg', () => {
  function face(id: string): Face {
    const found = findFace(lib, id[0] ?? '', Number(id.slice(1)))
    if (!found) throw new Error(id)
    return found
  }

  it('draws the same bytes for the same input', () => {
    const input = { face: face('W07'), ground: 0, size: 160 }
    expect(composeSvg(lib, input)).toBe(composeSvg(lib, input))
  })

  it('textures the ground only in the full cut, and grows the figure only in the small one', () => {
    const full = composeSvg(lib, { face: face('M13'), ground: 2, size: 160, cut: 'full' })
    const flat = composeSvg(lib, { face: face('M13'), ground: 2, size: 160, cut: 'flat' })
    const small = composeSvg(lib, { face: face('M13'), ground: 2, size: 160, cut: 'small' })
    const textures = ['t-lino', 't-felt', 't-stitch'].map((name) => lib.parts.get(name) ?? name)
    expect(textures.some((texture) => full.includes(texture))).toBe(true)
    expect(textures.some((texture) => flat.includes(texture))).toBe(false)
    expect(full.length).toBeGreaterThan(flat.length)
    expect(flat).not.toContain('scale(')
    expect(small).toContain('scale(1.15)')
    expect(small.length).toBeGreaterThan(flat.length)
  })

  it('picks the cut from the size when the caller does not', () => {
    const at = (size: number) => composeSvg(lib, { face: face('N01'), ground: 0, size })
    expect(at(48)).toContain('scale(1.15)')
    expect(at(96)).not.toContain('scale(1.15)')
  })

  it('paints the ground it is given and refuses one that does not exist', () => {
    expect(composeSvg(lib, { face: face('N01'), ground: 5, size: 96 })).toContain('fill="#bba4ff"')
    expect(() => composeSvg(lib, { face: face('N01'), ground: 6, size: 96 })).toThrow()
  })

  /*
   * One snapshot per pool and cut, as a digest: the SVGs are a few KB each,
   * and what the snapshot guards is "nothing changed by accident", which a
   * digest says as well as the text would. A deliberate redraw updates it.
   */
  it('matches the reviewed art', () => {
    const sample: Record<string, string> = {}
    for (const id of ['W01', 'W03', 'M02', 'M05', 'M08', 'N07', 'N19']) {
      for (const cut of ['full', 'flat', 'small'] as const) {
        sample[`${id} ${cut}`] = digest(
          composeSvg(lib, { face: face(id), ground: 1, size: 96, cut }),
        )
      }
    }
    expect(sample).toMatchSnapshot()
  })
})

describe('renderDefaultAvatar', () => {
  it('rasterises to a PNG of the requested size', async () => {
    clearAvatarCache()
    const png = await renderDefaultAvatar({
      avatar: { pool: 'W', index: 7, ground: 0 },
      size: 96,
      cut: 'full',
    })
    expect(png.subarray(1, 4).toString()).toBe('PNG')
    // IHDR width and height, big-endian, at bytes 16–23.
    expect(png.readUInt32BE(16)).toBe(96)
    expect(png.readUInt32BE(20)).toBe(96)
  })

  it('answers a repeat from the cache with the same buffer', async () => {
    const input = { avatar: { pool: 'M', index: 1, ground: 3 }, size: 48, cut: 'small' } as const
    const first = await renderDefaultAvatar(input)
    expect(await renderDefaultAvatar(input)).toBe(first)
  })

  it('renders a burst once per face, two at a time, off the event loop', async () => {
    clearAvatarCache()
    const faces = Array.from({ length: 6 }, (_, i) => ({
      avatar: { pool: 'W' as const, index: i + 10, ground: 1 },
      size: 160 as const,
      cut: 'full' as const,
    }))
    // Every face asked for three times at once, as a cold list on three phones.
    const asked = faces.flatMap((face) => [face, face, face]).map(renderDefaultAvatar)
    const load = renderLoad()
    expect(load.inFlight).toBe(6)
    expect(load.running).toBeLessThanOrEqual(2)
    const pngs = await Promise.all(asked)
    // The three asks for one face got the one buffer.
    for (let i = 0; i < faces.length; i++) {
      expect(pngs[i * 3 + 1]).toBe(pngs[i * 3])
      expect(pngs[i * 3 + 2]).toBe(pngs[i * 3])
    }
    expect(renderLoad()).toEqual({ running: 0, waiting: 0, inFlight: 0 })
  })

  it('refuses a face outside the pool', async () => {
    await expect(
      renderDefaultAvatar({ avatar: { pool: 'N', index: 49, ground: 0 }, size: 48, cut: 'small' }),
    ).rejects.toThrow()
  })
})
