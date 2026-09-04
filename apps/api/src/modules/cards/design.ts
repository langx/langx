import type { CardKind, CardShape } from '@langx/shared'
import { CARD_PIXELS, loadBadge, type CardNode } from './render'

export interface CardCopy {
  /** The big line — a numeral, usually. Localised by the caller. */
  headline: string
  /** The line under it, saying what the number is. */
  caption: string
  /** The handle, with its `@`. */
  handle: string
}

function el(type: string, props: CardNode['props']): CardNode {
  return { type, props }
}

const INK = '#17191c'
const PAPER = '#ffffff'

/**
 * The card's own glyph, drawn rather than typed.
 *
 * An emoji would have been one character and is not available: satori matches
 * glyphs against the fonts it is handed, and Nunito has no emoji in it — an
 * emoji renders as tofu, or as nothing. Shipping a colour emoji font to draw
 * three symbols is several megabytes in the image for three symbols. These are
 * paths instead, tinted to the card's own colour.
 */
const GLYPH: Record<CardKind, string> = {
  // A flame. Solid and wide at the base — the thin-wisped version of this
  // read as a water droplet at the size it is actually drawn.
  streak:
    'M13.1 1.5c.6 2.6.1 4.4-1.4 6.2-1.1 1.3-1.6 2.2-1.6 3.3 0 .9.4 1.7 1 2.3-1.6-.2-2.6-1.4-2.9-3.2C6.6 11.7 5.5 13.8 5.5 16c0 3.6 2.9 6.5 6.5 6.5s6.5-2.9 6.5-6.5c0-2.9-1.3-5-3-6.9-1.6-1.8-2.4-3.4-2.4-7.6z',
  // A rosette.
  badge:
    'M12 2l2.6 1.9 3.2-.2.9 3.1 2.6 1.9-1.4 2.9 1.4 2.9-2.6 1.9-.9 3.1-3.2-.2L12 22l-2.6-1.9-3.2.2-.9-3.1L2.7 15.4l1.4-2.9-1.4-2.9 2.6-1.9.9-3.1 3.2.2z',
  // A cup.
  rank: 'M6 3h12v3h3v3a4 4 0 0 1-4 4h-.3A6 6 0 0 1 13 16v3h3v2H8v-2h3v-3a6 6 0 0 1-3.7-2.9H7a4 4 0 0 1-4-4V6h3zM5 8v1a2 2 0 0 0 1 1.7V8zm14 0h-2v2.7A2 2 0 0 0 19 9z',
}

/** An SVG data URI, because satori draws images and not raw markup. */
function glyphImage(kind: CardKind, colour: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<path fill="${colour}" d="${GLYPH[kind]}"/></svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

/**
 * One ground colour per kind, so a streak and a rank are told apart across a
 * timeline before either is read. Taken from `theme/tokens.ts` — a card is the
 * app's own colours leaving the app, and a second palette would drift.
 */
const GROUND: Record<CardKind, string> = {
  streak: '#f79009',
  badge: '#7a5af8',
  rank: '#ffc409',
}

/** Yellow needs dark type on it; the other two do not. */
const ON_GROUND: Record<CardKind, string> = {
  streak: PAPER,
  badge: PAPER,
  rank: '#201900',
}

/**
 * The headline shrinks as it lengthens.
 *
 * A streak is "47" and a badge is a name, and one type size cannot serve both
 * — at the numeral's size a badge title runs off the card, and at the title's
 * size the numeral stops being the point of the picture.
 */
function headlineSize(text: string, unit: number, dense: number): number {
  const base = text.length <= 3 ? 30 : text.length <= 6 ? 20 : text.length <= 12 ? 12 : 8
  return unit * base * dense
}

/**
 * One layout, three shapes.
 *
 * Every measurement is in `unit` — a hundredth of the card's shorter side — so
 * the design is the same design at 1200×675 and at 1080×1920 rather than the
 * same pixels scaled into a different hole. The panel is what makes the tall
 * shape work: a story is mostly ground with the message held in the middle,
 * which is a composition, where a story with the message simply centred in
 * white is an accident.
 */
export async function cardElement(
  kind: CardKind,
  copy: CardCopy,
  shape: CardShape,
  /**
   * The owner's profile QR, as a data URI, or nothing.
   *
   * This is what turns the card from a picture of a number into something a
   * stranger can act on: a story is watched on one phone and scanned with
   * another, and without it the only route from the card back to the person is
   * reading a handle off the screen and typing it. Optional so a failure to
   * draw one costs the caption and not the card.
   */
  qr?: string,
): Promise<CardNode> {
  const { width, height } = CARD_PIXELS[shape]
  const unit = Math.min(width, height) / 100
  /*
   * How much vertical room the shape actually has.
   *
   * `unit` is the shorter side, which on a wide card is its height — so a
   * layout that fits a square in that unit is the same layout stacked into a
   * card less than half as tall, and it overflowed: the panel's corners were
   * clipped off the top and the mark was cut off the bottom. Everything on the
   * vertical axis is scaled by this, rather than the shape getting a layout of
   * its own — three layouts would be three things to keep in step.
   */
  const dense = width / height > 1.3 ? 0.62 : 1
  const badge = await loadBadge()
  const ground = GROUND[kind]
  const onGround = ON_GROUND[kind]

  return el('div', {
    style: {
      alignItems: 'center',
      backgroundColor: ground,
      display: 'flex',
      flexDirection: 'column',
      height,
      justifyContent: 'center',
      overflow: 'hidden',
      position: 'relative',
      width,
    },
    children: [
      /*
       * Two translucent discs, bled off opposite corners. They do nothing but
       * stop the ground reading as a flat fill — which at story size is a lot
       * of one colour — and they are placed off-canvas on purpose so the crop
       * is part of the composition rather than a shape that missed.
       */
      el('div', {
        style: {
          backgroundColor: 'rgba(255,255,255,0.14)',
          borderRadius: unit * 40,
          display: 'flex',
          height: unit * 80,
          left: -unit * 30,
          position: 'absolute',
          top: -unit * 26,
          width: unit * 80,
        },
      }),
      el('div', {
        style: {
          backgroundColor: 'rgba(0,0,0,0.07)',
          borderRadius: unit * 30,
          bottom: -unit * 22,
          display: 'flex',
          height: unit * 60,
          position: 'absolute',
          right: -unit * 20,
          width: unit * 60,
        },
      }),

      el('div', {
        style: {
          alignItems: 'center',
          backgroundColor: PAPER,
          borderRadius: unit * 8,
          display: 'flex',
          flexDirection: 'column',
          gap: unit * 2 * dense,
          paddingBottom: unit * 9 * dense,
          paddingLeft: unit * 8,
          paddingRight: unit * 8,
          paddingTop: unit * 9 * dense,
          width: width - unit * 16,
        },
        children: [
          el('img', {
            src: glyphImage(kind, ground),
            width: unit * 13 * dense,
            height: unit * 13 * dense,
            style: { marginBottom: unit * 1 },
          }),
          el('div', {
            style: {
              color: ground,
              display: 'flex',
              fontSize: headlineSize(copy.headline, unit, dense),
              fontWeight: 800,
              lineHeight: 1.05,
              textAlign: 'center',
            },
            children: copy.headline,
          }),
          el('div', {
            style: {
              color: INK,
              display: 'flex',
              fontSize: unit * 6 * dense,
              fontWeight: 800,
              textAlign: 'center',
            },
            children: copy.caption,
          }),
          el('div', {
            style: {
              color: '#62676d',
              display: 'flex',
              fontSize: unit * 4.2 * dense,
              fontWeight: 600,
              marginTop: unit * 2 * dense,
            },
            children: copy.handle,
          }),
        ],
      }),

      /*
       * The mark sits on the ground below the panel rather than inside it: a
       * signature under somebody's achievement, not a logo stuck on top of it.
       */
      el('div', {
        style: {
          alignItems: 'center',
          display: 'flex',
          gap: unit * 2.5,
          marginTop: unit * 5 * dense,
        },
        children: [
          el('img', { src: badge, width: unit * 8, height: unit * 8 }),
          el('div', {
            style: {
              color: onGround,
              display: 'flex',
              fontSize: unit * 5,
              fontWeight: 800,
              letterSpacing: unit * 0.1,
            },
            children: 'langx.io',
          }),
        ],
      }),

      ...(qr
        ? [
            el('div', {
              style: {
                alignItems: 'center',
                bottom: unit * 6,
                display: 'flex',
                flexDirection: 'row',
                gap: unit * 3,
                position: 'absolute',
                right: unit * 6,
              },
              children: [
                /*
                 * On a white tile, because a QR needs its quiet zone and its
                 * contrast — a code laid straight onto the coloured ground
                 * scans from a phone held still and fails from one held by a
                 * person.
                 */
                el('div', {
                  style: {
                    alignItems: 'center',
                    backgroundColor: PAPER,
                    borderRadius: unit * 3,
                    display: 'flex',
                    justifyContent: 'center',
                    padding: unit * 1.5,
                  },
                  children: [el('img', { src: qr, width: unit * 14, height: unit * 14 })],
                }),
              ],
            }),
          ]
        : []),
    ],
  })
}
