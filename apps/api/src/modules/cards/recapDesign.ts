import { isRtlLocale, type CardShape, type Locale, type RecapStat } from '@langx/shared'
import { CARD_PIXELS, type CardNode } from './render'

/**
 * The monthly recap, drawn as a poster rather than as a badge.
 *
 * Every other card is one number on a panel. A month is four, and four
 * numbers on that panel read as a receipt — so the recap gets a layout of its
 * own, the one designed for it in Claude Design ("Your Month", options 1a and
 * 1d): the month's name as the headline, set as large as it will go on one
 * line, and the numbers as a checkerboard of tiles under it. Same ground rules
 * as `design.ts`: the app's own tokens, and nothing drawn from a font the
 * renderer was not handed.
 */

export interface RecapCardContent {
  /** The month's name in the reader's language, capitalised: "September" — or, on a year's card, the year. */
  month: string
  /** `2026`, as the reader writes it; absent on a year's card, where it is the headline. */
  year?: string
  /** "My month" or "My year", set in capitals above the month. */
  kicker: string
  /** "in two languages, with 12 people", count already filled in; or nothing. */
  people?: string
  /** At most four, in the order `recapHighlights` chose. */
  stats: { stat: RecapStat; value: string; label: string }[]
  /** With its `@`. */
  handle: string
  /** "Spanish → learning Turkish", or nothing. */
  languages?: string
  /** A PNG or JPEG data URI, or nothing — then the handle's initial is drawn. */
  avatar?: string
  locale: Locale
}

// From `apps/mobile/src/lib/theme/tokens.ts`, light scheme: a card leaving the
// app should be the app's colours, not a second palette that drifts.
export const BLUE = '#3b6cf6'
export const YELLOW = '#ffc409'
export const ON_YELLOW = '#201900'
export const INK = '#17191c'
export const PAPER = '#ffffff'
const PAPER_80 = 'rgba(255, 255, 255, 0.8)'
const PAPER_88 = 'rgba(255, 255, 255, 0.88)'

/**
 * The two arcs of the mark, for a coloured ground — the brand's
 * `logo/mark-arcs.svg`, whose colours are never changed. Inline because it is
 * 600 bytes and satori has no filesystem.
 */
const MARK_ARCS =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">' +
  '<path fill="#000000" d="M393.661 591.654A235.3 235.3 0 0 1 462.846 266.161A235.3 235.3 0 0 1 788.339 335.346L718.059 380.987A151.5 151.5 0 0 0 508.487 336.441A151.5 151.5 0 0 0 463.941 546.013Z"/>' +
  '<path fill="#ffffff" d="M630.339 432.346A235.3 235.3 0 0 1 561.154 757.839A235.3 235.3 0 0 1 235.661 688.654L305.941 643.013A151.5 151.5 0 0 0 515.513 687.559A151.5 151.5 0 0 0 560.059 477.987Z"/>' +
  '</svg>'
export const MARK_SRC = `data:image/svg+xml;base64,${Buffer.from(MARK_ARCS).toString('base64')}`

/**
 * The colours of everything that is not a tile: the poster is white on blue,
 * and a slide's card is the slide's own ink on the slide's own ground.
 */
export interface Ink {
  /** The month, the handle, the wordmark. */
  text: string
  /** The kicker above the month. */
  kicker: string
  /** The sentence under the month, the languages under the handle. */
  soft: string
  /** The mark beside the wordmark, as a data URI. */
  mark: string
  /** The disc an absent face is drawn on, and the ring round a present one. */
  chip: string
  /** The initial on that disc. */
  chipText: string
}

const ON_BLUE: Ink = {
  text: PAPER,
  kicker: PAPER_80,
  soft: PAPER_88,
  mark: MARK_SRC,
  chip: PAPER,
  chipText: BLUE,
}

export function el(type: string, props: CardNode['props']): CardNode {
  return { type, props }
}

/** An arrow, drawn: Nunito has no U+2192 and satori draws an empty box. */
function arrowSrc(colour: string, pointsLeft: boolean): string {
  const path = pointsLeft ? 'M20 12H5m6-6-6 6 6 6' : 'M4 12h15m-6-6 6 6-6 6'
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${colour}" ` +
    `stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

type TextStyle = Record<string, unknown> & { fontSize: number; color: string }

/**
 * A line of text, laid out one word per element when it has to be.
 *
 * Left to right that is only for the arrow in the languages line. Right to
 * left it is everywhere: satori's bidirectional pass drops ordinary spaces,
 * reverses a Latin word and moves a number to the wrong end of a sentence —
 * `بلغتين، مع 12 شخصًا` came out with its first two words swapped and the 12
 * glued to one of them. A row of single words, put in order by the flex
 * direction rather than by the text engine, leaves that pass nothing to
 * reorder, and each word is still shaped whole, so Arabic letters still join.
 */
export function textLine(text: string, style: TextStyle, rtl: boolean, width?: number): CardNode {
  const sized = width ? { width } : {}
  if (!rtl && !/[→←]/.test(text)) {
    return el('div', { style: { display: 'flex', ...sized, ...style }, children: text })
  }
  return el('div', {
    style: {
      alignItems: 'center',
      columnGap: style.fontSize * 0.28,
      display: 'flex',
      flexDirection: rtl ? 'row-reverse' : 'row',
      flexShrink: 0,
      flexWrap: 'wrap',
      ...sized,
    },
    children: text
      .split(/\s+/)
      .filter(Boolean)
      .map((word) =>
        word === '→' || word === '←'
          ? el('img', {
              // Drawn the way the catalogue wrote it, which is the way that
              // language reads.
              src: arrowSrc(style.color, word === '←'),
              width: style.fontSize * 0.9,
              height: style.fontSize * 0.9,
            })
          : el('div', { style: { ...style, display: 'flex', flexShrink: 0 }, children: word }),
      ),
  })
}

/**
 * A type size that sets `text` on one line of `width`.
 *
 * satori measures nothing before layout, so this estimates from the character
 * count: Nunito Black at the design's tight tracking averages a little over
 * half an em per character across the scripts the app ships. Generous on
 * purpose — a month a size smaller than it could be is invisible; one that
 * wraps or runs off the card is not.
 */
export function fitSize(text: string, width: number, max: number, perChar: number): number {
  const chars = Math.max([...text].length, 1)
  return Math.min(max, width / (chars * perChar))
}

/** Every measurement the three shapes differ in, in pixels. */
export interface Metrics {
  mark: number
  wordmark: number
  kicker: number
  month: number
  people: number
  tileRadius: number
  tilePadY: number
  tilePadX: number
  tileGap: number
  tileNumber: number
  tileLabel: number
  avatar: number
  handle: number
  languages: number
  site: number
  qr: number
}

export const METRICS: Record<CardShape, Metrics> = {
  story: {
    mark: 84,
    wordmark: 54,
    kicker: 34,
    month: 176,
    people: 40,
    tileRadius: 44,
    tilePadY: 44,
    tilePadX: 48,
    tileGap: 28,
    tileNumber: 170,
    tileLabel: 40,
    avatar: 120,
    handle: 50,
    languages: 32,
    site: 40,
    qr: 150,
  },
  square: {
    mark: 70,
    wordmark: 46,
    kicker: 28,
    month: 112,
    people: 0,
    tileRadius: 32,
    tilePadY: 30,
    tilePadX: 30,
    tileGap: 20,
    tileNumber: 110,
    tileLabel: 30,
    avatar: 84,
    handle: 42,
    languages: 0,
    site: 36,
    qr: 0,
  },
  wide: {
    mark: 56,
    wordmark: 36,
    kicker: 22,
    month: 104,
    people: 26,
    tileRadius: 28,
    tilePadY: 24,
    tilePadX: 26,
    tileGap: 16,
    tileNumber: 92,
    tileLabel: 24,
    avatar: 64,
    handle: 30,
    languages: 20,
    site: 0,
    qr: 0,
  },
}

/** Yellow and white in a checkerboard, so two neighbours never match. */
function tileColours(
  index: number,
  count: number,
): { ground: string; number: string; label: string } {
  // With three the first tile runs full width over a pair: yellow there and
  // on neither of the pair keeps the checkerboard.
  const yellow = count === 3 ? index === 0 : index === 0 || index === 3
  return yellow
    ? { ground: YELLOW, number: ON_YELLOW, label: ON_YELLOW }
    : { ground: PAPER, number: BLUE, label: INK }
}

function statTile(
  stat: RecapCardContent['stats'][number],
  index: number,
  count: number,
  width: number,
  m: Metrics,
  rtl: boolean,
): CardNode {
  const colours = tileColours(index, count)
  const inner = width - m.tilePadX * 2
  return el('div', {
    style: {
      alignItems: rtl ? 'flex-end' : 'flex-start',
      backgroundColor: colours.ground,
      borderRadius: m.tileRadius,
      display: 'flex',
      flex: 1,
      flexDirection: 'column',
      justifyContent: 'space-between',
      paddingBottom: m.tilePadY,
      paddingLeft: m.tilePadX,
      paddingRight: m.tilePadX,
      paddingTop: m.tilePadY,
      width,
    },
    children: [
      el('div', {
        style: {
          color: colours.number,
          display: 'flex',
          flexShrink: 0,
          fontSize: fitSize(stat.value, inner, m.tileNumber, 0.56),
          fontWeight: 900,
          letterSpacing: '-0.05em',
          lineHeight: 0.9,
        },
        children: stat.value,
      }),
      textLine(
        stat.label,
        { color: colours.label, fontSize: m.tileLabel, fontWeight: 800, lineHeight: 1.15 },
        rtl,
        inner,
      ),
    ],
  })
}

/**
 * The tiles, in rows of two that share whatever height the column leaves.
 * Three is one wide tile over a pair, so the grid never has a hole in it.
 */
function statGrid(content: RecapCardContent, width: number, m: Metrics, rtl: boolean): CardNode {
  const half = (width - m.tileGap) / 2
  const stats = content.stats
  const count = stats.length
  const rows =
    count === 3 ? [stats.slice(0, 1), stats.slice(1)] : [stats.slice(0, 2), stats.slice(2, 4)]
  let index = 0
  return el('div', {
    style: { display: 'flex', flex: 1, flexDirection: 'column', gap: m.tileGap, width },
    children: rows
      .filter((row) => row.length > 0)
      .map((row) =>
        el('div', {
          style: {
            display: 'flex',
            flex: 1,
            flexDirection: rtl ? 'row-reverse' : 'row',
            gap: m.tileGap,
            width,
          },
          children: row.map((stat) =>
            statTile(stat, index++, count, row.length === 1 ? width : half, m, rtl),
          ),
        }),
      ),
  })
}

export function brand(m: Metrics, rtl: boolean, ink: Ink = ON_BLUE): CardNode {
  return el('div', {
    style: {
      alignItems: 'center',
      display: 'flex',
      flexDirection: rtl ? 'row-reverse' : 'row',
      flexShrink: 0,
      gap: m.mark * 0.26,
    },
    children: [
      el('img', { src: ink.mark, width: m.mark, height: m.mark }),
      el('div', {
        style: {
          color: ink.text,
          display: 'flex',
          fontSize: m.wordmark,
          fontWeight: 800,
          letterSpacing: '-0.02em',
        },
        children: 'LangX',
      }),
    ],
  })
}

function avatarNode(content: Owner, size: number, ink: Ink): CardNode {
  if (content.avatar) {
    return el('img', {
      src: content.avatar,
      width: size,
      height: size,
      style: { border: `${Math.round(size * 0.04)}px solid ${ink.chip}`, borderRadius: size },
    })
  }
  return el('div', {
    style: {
      alignItems: 'center',
      backgroundColor: ink.chip,
      borderRadius: size,
      color: ink.chipText,
      display: 'flex',
      flexShrink: 0,
      fontSize: size * 0.46,
      fontWeight: 800,
      height: size,
      justifyContent: 'center',
      width: size,
    },
    // The handle's first letter: Latin by construction, so Nunito draws it in
    // every locale and it never meets the right-to-left reordering.
    children: (content.handle.replace(/^@/, '')[0] ?? '?').toUpperCase(),
  })
}

/** Whose card it is: what `owner` draws. */
type Owner = Pick<RecapCardContent, 'handle' | 'languages' | 'avatar'>

/** The face, the handle, and the languages under it. */
export function owner(content: Owner, m: Metrics, rtl: boolean, ink: Ink = ON_BLUE): CardNode {
  const lines: CardNode[] = [
    el('div', {
      style: {
        color: ink.text,
        display: 'flex',
        fontSize: m.handle,
        fontWeight: 800,
        letterSpacing: '-0.02em',
      },
      children: content.handle,
    }),
  ]
  if (content.languages && m.languages > 0) {
    lines.push(
      textLine(content.languages, { color: ink.soft, fontSize: m.languages, fontWeight: 600 }, rtl),
    )
  }
  return el('div', {
    style: {
      alignItems: 'center',
      display: 'flex',
      flexDirection: rtl ? 'row-reverse' : 'row',
      // Gives way to `langx.io` beside it on a story: a long languages line
      // ("испанский → учу турецкий") wraps rather than running under it.
      flexShrink: 1,
      gap: m.avatar * 0.22,
    },
    children: [
      avatarNode(content, m.avatar, ink),
      el('div', {
        style: {
          alignItems: rtl ? 'flex-end' : 'flex-start',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 1,
          gap: 8,
        },
        children: lines,
      }),
    ],
  })
}

/**
 * The kicker, the month and the sentence under it.
 *
 * The year is its own element rather than part of the kicker's sentence: in
 * Arabic a mixed run is where satori's reordering goes wrong, and a lone
 * number is safe on either side of one.
 */
export function headline(
  content: Pick<RecapCardContent, 'kicker' | 'locale' | 'year' | 'month' | 'people'>,
  width: number,
  m: Metrics,
  rtl: boolean,
  ink: Ink = ON_BLUE,
): CardNode {
  const kicker = rtl ? content.kicker : content.kicker.toLocaleUpperCase(content.locale)
  const kickerStyle = {
    color: ink.kicker,
    fontSize: m.kicker,
    fontWeight: 800,
    // Tracking only where there are capitals to track: spaced-out Arabic
    // breaks the joins between its letters.
    letterSpacing: rtl ? 0 : '0.14em',
  } as const
  const children: CardNode[] = [
    el('div', {
      style: {
        alignItems: 'center',
        display: 'flex',
        flexDirection: rtl ? 'row-reverse' : 'row',
        flexShrink: 0,
        gap: m.kicker * 0.5,
      },
      children: [
        textLine(kicker, kickerStyle, rtl),
        ...(content.year
          ? [
              el('div', { style: { ...kickerStyle, display: 'flex' }, children: '·' }),
              el('div', { style: { ...kickerStyle, display: 'flex' }, children: content.year }),
            ]
          : []),
      ],
    }),
    el('div', {
      style: {
        color: ink.text,
        display: 'flex',
        flexShrink: 0,
        fontSize: fitSize(content.month, width, m.month, 0.56),
        fontWeight: 900,
        letterSpacing: rtl ? 0 : '-0.055em',
        lineHeight: rtl ? 1.2 : 0.9,
      },
      children: content.month,
    }),
  ]
  if (content.people && m.people > 0) {
    children.push(
      textLine(
        content.people,
        { color: ink.soft, fontSize: m.people, fontWeight: 600 },
        rtl,
        width,
      ),
    )
  }
  return el('div', {
    style: {
      alignItems: rtl ? 'flex-end' : 'flex-start',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      gap: m.kicker * 0.65,
      width,
    },
    children,
  })
}

/** "langx.io" and, on a story, the code a second phone can scan. */
export function site(
  m: Metrics,
  rtl: boolean,
  qr: string | undefined,
  ink: Ink = ON_BLUE,
): CardNode {
  return el('div', {
    style: {
      alignItems: 'center',
      display: 'flex',
      flexDirection: rtl ? 'row-reverse' : 'row',
      flexShrink: 0,
      gap: 22,
    },
    children: [
      el('div', {
        style: { color: ink.text, display: 'flex', fontSize: m.site, fontWeight: 800 },
        children: 'langx.io',
      }),
      ...(qr && m.qr > 0
        ? [
            // On a white tile, for the quiet zone and the contrast a camera
            // pointed at somebody else's screen needs.
            el('div', {
              style: {
                backgroundColor: PAPER,
                borderRadius: 28,
                display: 'flex',
                flexShrink: 0,
                padding: 14,
              },
              children: [el('img', { src: qr, width: m.qr, height: m.qr })],
            }),
          ]
        : []),
    ],
  })
}

/**
 * The yellow disc bled off the top corner — the one piece of decoration, and
 * mirrored in Arabic, where the brand starts on the right.
 */
export function disc(size: number, offset: number, rtl: boolean, colour = YELLOW): CardNode {
  return el('div', {
    style: {
      backgroundColor: colour,
      borderRadius: size,
      display: 'flex',
      height: size,
      position: 'absolute',
      top: -offset,
      width: size,
      ...(rtl ? { left: -offset } : { right: -offset }),
    },
  })
}

export function recapCardElement(
  content: RecapCardContent,
  shape: CardShape,
  qr?: string,
): CardNode {
  const { width, height } = CARD_PIXELS[shape]
  const m = METRICS[shape]
  const rtl = isRtlLocale(content.locale)
  const align = rtl ? 'flex-end' : 'flex-start'
  const frame = {
    backgroundColor: BLUE,
    display: 'flex',
    height,
    overflow: 'hidden',
    position: 'relative',
    width,
  } as const

  if (shape === 'story') {
    const inner = width - 88 * 2
    return el('div', {
      style: { ...frame, flexDirection: 'column' },
      children: [
        disc(620, 200, rtl),
        el('div', {
          style: {
            alignItems: align,
            display: 'flex',
            flex: 1,
            flexDirection: 'column',
            gap: 56,
            padding: '96px 88px',
          },
          children: [
            brand(m, rtl),
            el('div', {
              style: { display: 'flex', marginTop: 70 },
              children: [headline(content, inner, m, rtl)],
            }),
            statGrid(content, inner, m, rtl),
            el('div', {
              style: {
                alignItems: 'center',
                display: 'flex',
                flexDirection: rtl ? 'row-reverse' : 'row',
                flexShrink: 0,
                gap: 32,
                justifyContent: 'space-between',
                width: inner,
              },
              children: [owner(content, m, rtl), site(m, rtl, qr)],
            }),
          ],
        }),
      ],
    })
  }

  if (shape === 'square') {
    const pad = 72
    const column = (width - pad * 2 - 40) / 2
    return el('div', {
      style: { ...frame, flexDirection: 'column' },
      children: [
        disc(440, 170, rtl),
        el('div', {
          style: {
            display: 'flex',
            flex: 1,
            flexDirection: rtl ? 'row-reverse' : 'row',
            gap: 40,
            padding: pad,
          },
          children: [
            el('div', {
              style: {
                alignItems: align,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                width: column,
              },
              children: [
                brand(m, rtl),
                headline(content, column, m, rtl),
                el('div', {
                  style: { alignItems: align, display: 'flex', flexDirection: 'column', gap: 18 },
                  children: [owner(content, m, rtl), site(m, rtl, undefined)],
                }),
              ],
            }),
            // Pushed down so the disc has the top of this column to itself.
            el('div', {
              style: { display: 'flex', marginTop: 210, width: column },
              children: [statGrid(content, column, m, rtl)],
            }),
          ],
        }),
      ],
    })
  }

  // Wide: the story's column turned on its side — words on one half, tiles on
  // the other. Not in the design, which stopped at the two shapes a story and
  // a feed take; kept because the sheet offers all three for every card.
  const pad = 56
  const column = (width - pad * 3) * 0.46
  const grid = width - pad * 3 - column
  return el('div', {
    style: { ...frame, flexDirection: 'column' },
    children: [
      disc(360, 150, rtl),
      el('div', {
        style: {
          display: 'flex',
          flex: 1,
          flexDirection: rtl ? 'row-reverse' : 'row',
          gap: pad,
          padding: pad,
        },
        children: [
          el('div', {
            style: {
              alignItems: align,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              width: column,
            },
            children: [brand(m, rtl), headline(content, column, m, rtl), owner(content, m, rtl)],
          }),
          el('div', {
            style: { display: 'flex', width: grid },
            children: [statGrid(content, grid, m, rtl)],
          }),
        ],
      }),
    ],
  })
}
