import { Resvg } from '@resvg/resvg-js'
import { describe, expect, it } from 'vitest'
import { CARD_PIXELS, renderCard, type CardNode } from './render'
import { cardElement } from './design'
import { el, textLine } from './recapDesign'

/*
 * Pixel checks on real renders, at the few coordinates that tell a working
 * layout from the three ways satori 0.62 broke it (#1868): a panel that ran
 * edge to edge, discs painted over the panel, and an Arabic comma at the wrong
 * end of its word. Each of these looked fine in every structural test and in
 * the type checker; only the picture showed them. A future satori bump that
 * moves any of them fails here instead of in production.
 *
 * Coordinates are found rather than hard-coded where the content decides
 * them, so a reworded caption does not fail a test about the box model.
 */

interface Bitmap {
  width: number
  height: number
  rgba: Buffer
}

/** resvg decodes the PNG: it draws an `<image>`, and nothing new is installed. */
function decode(png: Buffer, width: number, height: number): Bitmap {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${width}" height="${height}"><image width="${width}" height="${height}" ` +
    `xlink:href="data:image/png;base64,${png.toString('base64')}"/></svg>`
  const image = new Resvg(svg).render()
  return { width: image.width, height: image.height, rgba: image.pixels }
}

function pixel(bitmap: Bitmap, x: number, y: number): [number, number, number] {
  const at = (y * bitmap.width + x) * 4
  return [bitmap.rgba[at]!, bitmap.rgba[at + 1]!, bitmap.rgba[at + 2]!]
}

const isWhite = (rgb: [number, number, number]) => rgb.every((channel) => channel === 255)

/** The rows of column `x` that are pure white, as one run: the panel's top and bottom. */
function whiteRun(bitmap: Bitmap, x: number): { top: number; bottom: number } {
  const rows = [...Array(bitmap.height).keys()].filter((y) => isWhite(pixel(bitmap, x, y)))
  return { top: rows[0]!, bottom: rows.at(-1)! }
}

async function render(node: CardNode, shape: 'story' | 'square' | 'wide'): Promise<Bitmap> {
  const { width, height } = CARD_PIXELS[shape]
  return decode(await renderCard(node, shape), width, height)
}

const ROWS = 400

const COPY = { headline: '47', caption: 'day streak', handle: '@sofia' }

describe('card layout under satori', () => {
  it.each(['story', 'square', 'wide'] as const)(
    'insets the panel from the edges of a %s card',
    async (shape) => {
      const card = await render(await cardElement('streak', COPY, shape), shape)
      const unit = Math.min(card.width, card.height) / 100
      // A column inside the panel's left padding: never text, white only
      // where the panel is.
      const { top, bottom } = whiteRun(card, Math.round(unit * 12))
      const row = Math.round((top + bottom) / 2)
      const white = [...Array(card.width).keys()].filter((x) => isWhite(pixel(card, x, row)))
      // 8 units of ground either side, as designed. Edge to edge — 0 and
      // width - 1 — is what padding outside the width produced.
      expect(white[0]).toBeGreaterThanOrEqual(Math.floor(unit * 8) - 1)
      expect(white[0]).toBeLessThanOrEqual(Math.ceil(unit * 8) + 1)
      expect(card.width - 1 - white.at(-1)!).toBeGreaterThanOrEqual(Math.floor(unit * 8) - 1)
      expect(isWhite(pixel(card, Math.round(unit * 4), row))).toBe(false)
    },
  )

  it('paints the panel over the discs', async () => {
    // The badge square is where it showed: the dark disc bled off the bottom
    // corner put a grey quarter-circle inside the panel. No QR, which would
    // otherwise sit over the same corner.
    const card = await render(
      await cardElement(
        'badge',
        { headline: 'محادث', caption: 'شارة جديدة', handle: '@sofia' },
        'square',
      ),
      'square',
    )
    const unit = card.width / 100
    const { bottom } = whiteRun(card, Math.round(unit * 12))
    // Inside the panel, clear of its rounded corner, and inside the disc
    // (centred at 90, 92 units with a radius of 30).
    const x = Math.round(unit * 88)
    const y = bottom - Math.round(unit * 10)
    expect(Math.hypot(x - unit * 90, y - unit * 92)).toBeLessThan(unit * 30)
    expect(pixel(card, x, y)).toEqual([255, 255, 255])
  })

  it('sets an Arabic comma after its word, on the left', async () => {
    /*
     * The word drawn alone and again with its comma, both from the left edge.
     * Set right to left, the comma comes first on the line, so the letters
     * move right by its width; set left to right it is tacked on after them
     * and the letters stay put — which is the bug.
     */
    const ink = async (
      text: string,
    ): Promise<{ at: (x: number, y: number) => boolean; right: number }> => {
      const card = await render(
        el('div', {
          style: {
            alignItems: 'flex-start',
            backgroundColor: '#ffffff',
            display: 'flex',
            height: 1080,
            padding: 40,
            width: 1080,
          },
          children: [textLine(text, { color: '#000000', fontSize: 120, fontWeight: 600 }, true)],
        }),
        'square',
      )
      const at = (x: number, y: number) => x < card.width && pixel(card, x, y)[0] < 128
      let right = 0
      for (let x = 0; x < card.width; x++) for (let y = 0; y < ROWS; y++) if (at(x, y)) right = x
      return { at, right }
    }
    const plain = await ink('بلغتين')
    const comma = await ink('بلغتين،')
    const shift = comma.right - plain.right
    expect(shift).toBeGreaterThan(10)

    // The share of the plain word's ink that is not ink in the other render
    // once moved by `offset`.
    const missing = (offset: number) => {
      let inked = 0
      let lost = 0
      for (let x = 0; x <= plain.right; x++) {
        for (let y = 0; y < ROWS; y++) {
          if (!plain.at(x, y)) continue
          inked++
          if (!comma.at(x + offset, y)) lost++
        }
      }
      return lost / inked
    }
    // The letters, moved by the comma's width — not where they were.
    expect(missing(shift)).toBeLessThan(0.05)
    expect(missing(0)).toBeGreaterThan(0.2)
  })
})
