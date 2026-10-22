import { BADGES, findBadge, hasPatch } from '@langx/shared'
import { Resvg } from '@resvg/resvg-js'
import { describe, expect, it } from 'vitest'
import { CARD_PIXELS, renderCard, type CardNode } from './render'
import { badgeCardElement, drawableName } from './badgeDesign'
import { profileCardElement, PROFILE_GROUNDS } from './profileDesign'
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
    // (centred at 90, 92 units with a radius of 30: the second disc in
    // `cardElement`, design.ts — move it and this point moves with it).
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

  it('leaves a Latin word in an Arabic line left to right', () => {
    // "Pro+" set right to left would come out "+Pro".
    const line = textLine('مشترك Pro+', { color: '#000000', fontSize: 40 }, true)
    const words = line.props.children as CardNode[]
    const direction = (node: CardNode) =>
      (node.props.style as Record<string, unknown>).direction ?? 'ltr'
    expect(words.map((word) => [word.props.children, direction(word)])).toEqual([
      ['مشترك', 'rtl'],
      ['Pro+', 'ltr'],
    ])
  })
})

/*
 * The badge card is the badge: its patch, large and in the middle. Until
 * the v3 art reached the card it was the same rosette for every badge, and
 * every structural test passed on it — so these look at the picture.
 */
describe('badge card layout under satori', () => {
  const content = (id: string, locale: 'en' | 'ar' = 'en') => {
    const badge = findBadge(id)!
    return {
      id,
      kind: badge.kind,
      name: badge.label,
      kicker: 'New badge',
      earned: 'Earned 12 October 2026',
      displayName: 'Sofia Martínez',
      handle: '@sofia',
      locale,
    } as const
  }

  /** The hero block: the white run down a column just inside its left edge. */
  const heroBox = (card: Bitmap, x: number) => {
    const { top, bottom } = whiteRun(card, x)
    const row = top + 12
    const white = [...Array(card.width).keys()].filter((at) => isWhite(pixel(card, at, row)))
    return { top, bottom, left: white[0]!, right: white.at(-1)! }
  }

  type Box = ReturnType<typeof heroBox>

  /** The share of the hero's middle that is not white: the patch, drawn. */
  const inked = (card: Bitmap, box: Box) => {
    const inset = Math.round((box.right - box.left) * 0.2)
    let all = 0
    let ink = 0
    for (let y = box.top + inset; y < box.bottom - inset; y += 4) {
      for (let x = box.left + inset; x < box.right - inset; x += 4) {
        all++
        if (!isWhite(pixel(card, x, y))) ink++
      }
    }
    return ink / all
  }

  /** A coarse fingerprint of the patch: a grid of samples across the block. */
  const fingerprint = (card: Bitmap, box: Box) => {
    const samples: string[] = []
    for (let i = 1; i < 6; i++) {
      for (let j = 1; j < 6; j++) {
        const x = Math.round(box.left + ((box.right - box.left) * i) / 6)
        const y = Math.round(box.top + ((box.bottom - box.top) * j) / 6)
        samples.push(pixel(card, x, y).join())
      }
    }
    return samples.join('|')
  }

  it.each(['story', 'square'] as const)('centres the patch on a %s card', async (shape) => {
    const card = await render(badgeCardElement(content('streak.7'), shape), shape)
    // The hero's left edge sits at (width - hero) / 2; a few pixels in is
    // white from its top to its bottom and nowhere else in that column.
    const hero = shape === 'story' ? 904 : 500
    const box = heroBox(card, Math.round((card.width - hero) / 2) + 14)
    expect(Math.abs(box.left - (card.width - 1 - box.right))).toBeLessThanOrEqual(2)
    // Large: the block is most of the card's width.
    expect(box.right - box.left).toBeGreaterThan(card.width * 0.44)
    expect(inked(card, box)).toBeGreaterThan(0.3)
  })

  it('draws its own patch for every kind, Early Adopter included', async () => {
    const kinds = new Map<string, string>()
    for (const badge of BADGES) if (badge.kind !== 'tokens') kinds.set(badge.kind, badge.id)
    expect([...kinds.values()]).toContain('origin.v1')

    const prints = new Set<string>()
    for (const id of kinds.values()) {
      expect(hasPatch(id), id).toBe(true)
      const card = await render(badgeCardElement(content(id), 'wide'), 'wide')
      const box = heroBox(card, 52 + 14)
      expect(inked(card, box), id).toBeGreaterThan(0.2)
      prints.add(fingerprint(card, box))
    }
    // Two kinds with one picture is the bug this card replaced.
    expect(prints.size).toBe(kinds.size)
  }, 120_000)

  it('puts the patch where the eye starts: left in English, right in Arabic', async () => {
    const at = async (locale: 'en' | 'ar') => {
      const card = await render(badgeCardElement(content('veteran.365', locale), 'wide'), 'wide')
      const y = Math.round(card.height / 2)
      return { left: isWhite(pixel(card, 80, y)), right: isWhite(pixel(card, card.width - 80, y)) }
    }
    expect(await at('en')).toEqual({ left: true, right: false })
    expect(await at('ar')).toEqual({ left: false, right: true })
  })

  it('keeps an English phrase in an Arabic line in its own order', () => {
    // "Early Adopter" is English in the Arabic catalogue; one word per
    // element in a reversed row drew it "Adopter Early".
    const words = (text: string) =>
      (textLine(text, { color: '#000000', fontSize: 40 }, true).props.children as CardNode[]).map(
        (word) => word.props.children,
      )
    expect(words('Early Adopter')).toEqual(['Early Adopter'])
    expect(words('شارة Early Adopter جديدة')).toEqual(['شارة', 'Early Adopter', 'جديدة'])
    // A number stays its own item: joined to "Pro+" it would read "12 Pro+".
    expect(words('مع 12 Pro+')).toEqual(['مع', '12', 'Pro+'])
  })

  it('leaves out a display name the faces cannot draw, and keeps the handle', () => {
    expect(drawableName('Sofia Martínez')).toBe('Sofia Martínez')
    expect(drawableName('صوفيا')).toBe('صوفيا')
    expect(drawableName('مُحَمَّد')).toBe('مُحَمَّد')
    expect(drawableName('Соня')).toBe('Соня')
    expect(drawableName('さくら')).toBeUndefined()
    expect(drawableName('Sofia 🌸')).toBeUndefined()
    expect(drawableName('  ')).toBeUndefined()
  })
})

/*
 * The profile card exists to be scanned off somebody else's screen, so what
 * these check is that the code is there and clear on every shape, and that
 * the person sits where a reader starts.
 */
describe('profile card layout under satori', () => {
  const content = (locale: 'en' | 'ar' = 'en') =>
    ({
      displayName: 'Sofia Martínez',
      handle: '@sofia',
      invitation: 'Practise languages with me',
      languages: 'Spanish → learning Turkish',
      ground: PROFILE_GROUNDS[0]!,
      locale,
    }) as const

  /** A magenta square standing in for the QR: no other pixel on the card is that colour. */
  const QR =
    'data:image/svg+xml;base64,' +
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#f0f"/></svg>',
    ).toString('base64')

  /** The magenta pixels, sampled: where the code was drawn. */
  const codeBox = (card: Bitmap) => {
    let left = card.width
    let right = -1
    let top = card.height
    let bottom = -1
    for (let y = 0; y < card.height; y += 2) {
      for (let x = 0; x < card.width; x += 2) {
        const [r, g, b] = pixel(card, x, y)
        if (r === 255 && g === 0 && b === 255) {
          left = Math.min(left, x)
          right = Math.max(right, x)
          top = Math.min(top, y)
          bottom = Math.max(bottom, y)
        }
      }
    }
    return { left, right, top, bottom }
  }

  it.each(['story', 'square', 'wide'] as const)(
    'carries a scannable code, whole and on the card, on a %s card',
    async (shape) => {
      const card = await render(profileCardElement(content(), shape, QR), shape)
      const box = codeBox(card)
      const side = box.right - box.left
      // Square, and big enough for a camera across a room: at least a sixth
      // of the card's short side.
      expect(Math.abs(side - (box.bottom - box.top))).toBeLessThanOrEqual(4)
      expect(side).toBeGreaterThan(Math.min(card.width, card.height) / 6)
      expect(box.left).toBeGreaterThan(0)
      expect(box.bottom).toBeLessThan(card.height - 1)
      // On a white quiet zone: just outside the code is paper, not ground.
      expect(isWhite(pixel(card, box.left - 6, Math.round((box.top + box.bottom) / 2)))).toBe(true)
    },
  )

  it('puts the person first where the reader starts: left in English, right in Arabic', async () => {
    const codeSide = async (locale: 'en' | 'ar') => {
      const card = await render(profileCardElement(content(locale), 'wide', QR), 'wide')
      return codeBox(card).left > card.width / 2 ? 'right' : 'left'
    }
    expect(await codeSide('en')).toBe('right')
    expect(await codeSide('ar')).toBe('left')
  })

  it('is the colour of the owner, as their Share page is', () => {
    // Six hues in `PARTNER_HUES` order (`apps/mobile/src/lib/theme/tokens.ts`):
    // `partnerHueIndex` picks by position, so the order is the identity.
    expect(PROFILE_GROUNDS).toEqual([
      '#bba4ff',
      '#48d3d0',
      '#5fdc98',
      '#b8e15c',
      '#74b9ff',
      '#ff9f52',
    ])
  })
})
