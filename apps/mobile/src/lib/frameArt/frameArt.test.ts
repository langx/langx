import { COSMETICS } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { cutFor, frameArtNodes, type ArtCut, type ArtNode, type ArtScheme } from './geometry'
import { ART_PALETTES, artForTone, type ArtKey } from './palettes'

const CUTS: ArtCut[] = ['full', 's40', 's28']
const SCHEMES: ArtScheme[] = ['light', 'dark']
const FRAMES = COSMETICS.filter((c) => c.kind === 'frame')

function flatten(nodes: readonly ArtNode[]): ArtNode[] {
  return nodes.flatMap((n) => (n.el === 'g' ? [n, ...flatten(n.kids)] : [n]))
}

/** The shapes the sheet's own build counted: no groups, the hello ring as text. */
function shapes(nodes: readonly ArtNode[]): ArtNode[] {
  return flatten(nodes).filter((n) => n.el !== 'g')
}

describe('frame art', () => {
  /**
   * The test the plan names. A frame with no art would fall back to a plain
   * ring under the flag, which is a frame somebody paid for drawn as the one
   * nobody did.
   */
  it('draws every frame in the catalogue, in its own art', () => {
    const keys = FRAMES.map((frame) => artForTone(frame.tone ?? ''))
    for (const [i, key] of keys.entries()) expect(key, FRAMES[i]!.id).toBeDefined()
    expect(new Set(keys).size).toBe(FRAMES.length)
  })

  it('has a drawing at every cut, in both schemes', () => {
    for (const frame of FRAMES) {
      const key = artForTone(frame.tone ?? '')!
      for (const cut of CUTS) {
        for (const scheme of SCHEMES) {
          expect(
            shapes(frameArtNodes(key, cut, scheme)).length,
            `${frame.id} ${cut} ${scheme}`,
          ).toBeGreaterThan(0)
        }
      }
    }
  })

  /** A palette key misspelt in the geometry would paint `undefined`: black. */
  it('paints with real colours only', () => {
    const colour = /^(#[0-9a-f]{6}|none)$/
    for (const key of Object.keys(ART_PALETTES) as ArtKey[]) {
      for (const cut of CUTS) {
        for (const scheme of SCHEMES) {
          for (const node of flatten(frameArtNodes(key, cut, scheme))) {
            const paints =
              node.el === 'hello'
                ? [node.fill]
                : [node.a.fill, node.a.stroke].filter((v) => v !== undefined)
            for (const paint of paints) {
              expect(String(paint), `${key} ${cut} ${scheme}`).toMatch(colour)
            }
          }
        }
      }
    }
  })

  it('keeps the 40 px cut to six shapes and no text, as the sheet requires', () => {
    for (const key of Object.keys(ART_PALETTES) as ArtKey[]) {
      for (const scheme of SCHEMES) {
        const cut = shapes(frameArtNodes(key, 's40', scheme))
        expect(cut.length, key).toBeLessThanOrEqual(6)
        expect(
          cut.some((n) => n.el === 'hello'),
          key,
        ).toBe(false)
      }
    }
  })

  it('writes the hello ring, and moves, on Aurora Glass at the full cut only', () => {
    for (const key of Object.keys(ART_PALETTES) as ArtKey[]) {
      for (const cut of CUTS) {
        const nodes = flatten(frameArtNodes(key, cut, 'light'))
        const expected = key === 'glass' && cut === 'full'
        expect(
          nodes.some((n) => n.el === 'hello'),
          `${key} ${cut}`,
        ).toBe(expected)
        expect(
          nodes.some((n) => n.el !== 'g' && n.el !== 'hello' && n.sweep === true),
          `${key} ${cut}`,
        ).toBe(expected)
      }
    }
  })

  /** The sheet's build refused to write a frame whose edge fell under 3:1. */
  it('holds each outer edge at 3:1 on both schemes', () => {
    const lum = (hex: string) => {
      const [r, g, b] = (hex.slice(1).match(/../g) ?? []).map((h) => {
        const c = parseInt(h, 16) / 255
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
    }
    const ratio = (a: string, b: string) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
      return (hi! + 0.05) / (lo! + 0.05)
    }
    for (const key of Object.keys(ART_PALETTES) as ArtKey[]) {
      const [light, dark] = ART_PALETTES[key].edge
      for (const ground of ['#ffffff', '#f2f2ee']) {
        expect(ratio(light, ground), `${key} light`).toBeGreaterThanOrEqual(3)
      }
      for (const ground of ['#0c0d10', '#1a1c21']) {
        expect(ratio(dark, ground), `${key} dark`).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('knows no art for a tone this build has never heard of', () => {
    expect(artForTone('cobalt')).toBeUndefined()
    expect(artForTone('constructor')).toBeUndefined()
  })

  it('picks the cut by the size it is drawn at', () => {
    expect(cutFor(96)).toBe('full')
    expect(cutFor(64)).toBe('full')
    expect(cutFor(63)).toBe('s40')
    expect(cutFor(48)).toBe('s40')
    expect(cutFor(40)).toBe('s40')
    expect(cutFor(36)).toBe('s28')
  })
})
