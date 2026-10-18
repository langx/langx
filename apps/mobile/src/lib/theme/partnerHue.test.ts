import { describe, expect, it } from 'vitest'
import { partnerHueFor } from './partnerHue'
import { PARTNER_HUES } from './tokens'

/** Ids shaped like ours: the string form of an ObjectId. */
function objectIdLike(n: number): string {
  return (0x66f0_0000 + n).toString(16).padStart(8, '0') + 'a1b2c3d4e5f60718'
}

describe('partnerHueFor', () => {
  it('gives an id the same hue every time', () => {
    const id = objectIdLike(42)
    const first = partnerHueFor(id)
    for (let i = 0; i < 5; i++) expect(partnerHueFor(id)).toBe(first)
  })

  it('pins the answer, so a change to the hash is a decision rather than an accident', () => {
    // Changing any of these re-colours every partner someone already knows by
    // colour. If this fails, the hash or the hue list moved — see the note on
    // PARTNER_HUES before updating the expectations.
    expect(partnerHueFor('')).toBe('aqua')
    expect(partnerHueFor('a')).toBe('sky')
    expect(partnerHueFor('66f1c2e0a1b2c3d4e5f60718')).toBe('mint')
    expect([1, 2, 3].map((n) => partnerHueFor(objectIdLike(n)))).toEqual(['lilac', 'aqua', 'mint'])
  })

  it('only ever answers one of the six hues', () => {
    for (let n = 0; n < 500; n++) expect(PARTNER_HUES).toContain(partnerHueFor(objectIdLike(n)))
  })

  it('spreads real-shaped ids across all six, none starved', () => {
    const counts = new Map<string, number>()
    const total = 600
    for (let n = 0; n < total; n++) {
      const hue = partnerHueFor(objectIdLike(n * 7919))
      counts.set(hue, (counts.get(hue) ?? 0) + 1)
    }
    expect(counts.size).toBe(PARTNER_HUES.length)
    // A fair split is 100 each; anything under half of that means a list of
    // partners would be mostly one or two colours.
    for (const hue of PARTNER_HUES) expect(counts.get(hue)).toBeGreaterThan(total / 12)
  })

  it('tells apart ids that differ in one character', () => {
    const base = '66f1c2e0a1b2c3d4e5f60718'
    const neighbours = new Set(
      '0123456789abcdef'.split('').map((c) => partnerHueFor(base.slice(0, -1) + c)),
    )
    expect(neighbours.size).toBeGreaterThan(2)
  })
})
