import { isRtlLocale, patchNodes, type BadgeKind, type CardShape, type Locale } from '@langx/shared'
import { el, fitSize, MARK_SRC, PAPER, RTL_LETTER, textLine, YELLOW } from './recapDesign'
import { CARD_PIXELS, type CardNode } from './render'

/**
 * A badge, drawn as the badge.
 *
 * The badge card used to be a rosette glyph on a violet ground with the
 * badge's name under it — the same picture for a 7-day streak and for Early
 * Adopter, and none of them the patch the shelf shows. This draws the patch
 * itself, from the geometry the app draws it from (`badgePatch/geometry.ts`
 * in `packages/shared`), as the hero of the card, in the v3 language: a hue
 * block for the ground, ink outlines round every block, Nunito, and yellow
 * exactly once — the pill that says what this is.
 */

export interface BadgeCardContent {
  /** The badge id, `streak.30`: which patch to draw. */
  id: string
  kind: BadgeKind
  /** The badge's name in the reader's language, as the app words it. */
  name: string
  /** "New badge". */
  kicker: string
  /** "Earned 12 October 2026", or nothing for a badge whose day is not known. */
  earned?: string
  /** The owner's display name, or nothing when it cannot be drawn (see `drawableName`). */
  displayName?: string
  /** With its `@`. */
  handle: string
  /** A PNG or JPEG data URI, or nothing — then the handle's initial. */
  avatar?: string
  locale: Locale
}

// `apps/mobile/src/lib/theme/tokens.ts`, v3, light: the ink every block is
// outlined in, and the six partner hues the grounds are taken from.
const INK = '#14161b'
const INK_SOFT = 'rgba(20, 22, 27, 0.72)'
const HUES = {
  lilac: '#bba4ff',
  aqua: '#48d3d0',
  mint: '#5fdc98',
  lime: '#b8e15c',
  sky: '#74b9ff',
  tangerine: '#ff9f52',
} as const

/**
 * One ground per family, so a streak and a call are told apart across a
 * timeline before either is read — and never the patch's own ground, which
 * would swallow its outline. `tokens` is here only because the `Record` asks
 * for every kind: a token badge's name is an amount, and no card is drawn
 * for one (`shareCards.ts`).
 */
const GROUND: Record<BadgeKind, string> = {
  streak: HUES.tangerine,
  correction: HUES.mint,
  messages: HUES.sky,
  tokens: HUES.lilac,
  veteran: HUES.lime,
  origin: HUES.sky,
  languages: HUES.lime,
  calls: HUES.aqua,
  echo: HUES.sky,
  testimonials: HUES.lilac,
  guide: HUES.mint,
  openers: HUES.tangerine,
}

/**
 * The patch as an SVG data URI, in its full cut — the 64-unit drawing with
 * every stitch, scaled up as a vector rather than blown up from a bitmap.
 *
 * satori draws an `<img>` of an SVG by handing it to resvg, which is happy
 * with any path; the geometry is written without arcs anyway, for `expo-image`
 * on iOS, so there is nothing here a renderer could disagree about.
 */
export function patchSvg(id: string): string {
  const paths = patchNodes(id, 'full', { kind: 'earned' }, 'light')
    .map((node) => {
      const path =
        `<path d="${node.d}" fill="${node.fill}" stroke="${node.stroke}" ` +
        `stroke-width="${node.strokeWidth}"${node.dash ? ` stroke-dasharray="${node.dash}"` : ''} ` +
        `stroke-linecap="${node.cap}" stroke-linejoin="round" opacity="${node.opacity}"/>`
      return node.transform ? `<g transform="${node.transform}">${path}</g>` : path
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${paths}</svg>`
}

function patchSrc(id: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(patchSvg(id)).toString('base64')}`
}

/** Letters satori has a face for: Nunito's Latin, Vietnamese and Cyrillic, and Noto's Arabic. */
const DRAWABLE =
  /^[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Arabic}\p{M}\p{N}\p{P}\p{Zs}'’.-]+$/u

/**
 * The display name, when every letter in it can be drawn — or nothing.
 *
 * A name is whatever its owner typed, and the card has three faces: a name in
 * Japanese or with an emoji in it would come out as a row of empty boxes,
 * which is worse on somebody's shared picture than no name at all. The handle
 * is always drawable (`handleSchema` is Latin) and is always on the card, so
 * a name that is dropped still leaves the card saying whose it is.
 */
export function drawableName(name: string | undefined): string | undefined {
  const trimmed = name?.normalize('NFC').trim()
  return trimmed && DRAWABLE.test(trimmed) ? trimmed : undefined
}

interface Metrics {
  pad: number
  /** The hero block's side. */
  hero: number
  patch: number
  outline: number
  mark: number
  wordmark: number
  kicker: number
  name: number
  earned: number
  avatar: number
  person: number
  handle: number
  qr: number
}

const METRICS: Record<CardShape, Metrics> = {
  story: {
    pad: 88,
    hero: 904,
    patch: 700,
    outline: 8,
    mark: 84,
    wordmark: 54,
    kicker: 38,
    name: 124,
    earned: 42,
    avatar: 120,
    person: 46,
    handle: 38,
    qr: 150,
  },
  square: {
    pad: 64,
    hero: 500,
    patch: 400,
    outline: 6,
    mark: 60,
    wordmark: 40,
    kicker: 28,
    name: 96,
    earned: 32,
    avatar: 84,
    person: 34,
    handle: 28,
    qr: 0,
  },
  wide: {
    pad: 52,
    hero: 571,
    patch: 450,
    outline: 6,
    mark: 52,
    wordmark: 34,
    kicker: 24,
    name: 64,
    earned: 26,
    avatar: 68,
    person: 28,
    handle: 24,
    qr: 0,
  },
}

/** The white block the patch sits in, outlined in ink. */
function hero(content: BadgeCardContent, m: Metrics): CardNode {
  return el('div', {
    style: {
      alignItems: 'center',
      backgroundColor: PAPER,
      border: `${m.outline}px solid ${INK}`,
      borderRadius: m.hero * 0.09,
      display: 'flex',
      flexShrink: 0,
      height: m.hero,
      justifyContent: 'center',
      width: m.hero,
    },
    children: [el('img', { src: patchSrc(content.id), width: m.patch, height: m.patch })],
  })
}

function brand(m: Metrics, rtl: boolean): CardNode {
  return el('div', {
    style: {
      alignItems: 'center',
      display: 'flex',
      flexDirection: rtl ? 'row-reverse' : 'row',
      flexShrink: 0,
      gap: m.mark * 0.26,
    },
    children: [
      el('img', { src: MARK_SRC, width: m.mark, height: m.mark }),
      el('div', {
        style: {
          color: INK,
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

/** The one yellow thing on the card. */
function kicker(content: BadgeCardContent, m: Metrics, rtl: boolean): CardNode {
  const text = rtl ? content.kicker : content.kicker.toLocaleUpperCase(content.locale)
  return el('div', {
    style: {
      backgroundColor: YELLOW,
      border: `${Math.max(3, m.outline - 2)}px solid ${INK}`,
      borderRadius: 999,
      display: 'flex',
      flexShrink: 0,
      padding: `${m.kicker * 0.32}px ${m.kicker * 0.8}px`,
    },
    children: [
      textLine(
        text,
        {
          color: INK,
          fontSize: m.kicker,
          fontWeight: 800,
          // Tracking only where there are capitals: spaced-out Arabic breaks
          // the joins between its letters.
          letterSpacing: rtl ? 0 : '0.08em',
        },
        rtl,
      ),
    ],
  })
}

/** The pill, the badge's name and the day it was earned. */
function title(content: BadgeCardContent, width: number, m: Metrics, rtl: boolean): CardNode {
  const lines: CardNode[] = [
    kicker(content, m, rtl),
    textLine(
      content.name,
      {
        color: INK,
        fontSize: fitSize(content.name, width, m.name, 0.56),
        fontWeight: 900,
        letterSpacing: rtl ? 0 : '-0.04em',
        lineHeight: rtl ? 1.25 : 1,
      },
      rtl,
      width,
    ),
  ]
  if (content.earned) {
    lines.push(
      textLine(
        content.earned,
        { color: INK_SOFT, fontSize: m.earned, fontWeight: 600 },
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
      gap: m.kicker * 0.6,
      width,
    },
    children: lines,
  })
}

function avatar(content: BadgeCardContent, m: Metrics): CardNode {
  const border = `${Math.max(3, m.outline - 2)}px solid ${INK}`
  if (content.avatar) {
    return el('img', {
      src: content.avatar,
      width: m.avatar,
      height: m.avatar,
      style: { border, borderRadius: m.avatar },
    })
  }
  return el('div', {
    style: {
      alignItems: 'center',
      backgroundColor: PAPER,
      border,
      borderRadius: m.avatar,
      color: INK,
      display: 'flex',
      flexShrink: 0,
      fontSize: m.avatar * 0.46,
      fontWeight: 800,
      height: m.avatar,
      justifyContent: 'center',
      width: m.avatar,
    },
    // Latin by construction (`handleSchema`), so Nunito draws it everywhere.
    children: (content.handle.replace(/^@/, '')[0] ?? '?').toUpperCase(),
  })
}

/** The face, the name and the handle: whose badge it is. */
function person(content: BadgeCardContent, m: Metrics, rtl: boolean): CardNode {
  const lines: CardNode[] = []
  if (content.displayName) {
    lines.push(
      textLine(
        content.displayName,
        { color: INK, fontSize: m.person, fontWeight: 800, lineHeight: 1.15 },
        // An Arabic name on an English card still goes word by word: left
        // to satori's own bidi it loses its spaces.
        rtl || RTL_LETTER.test(content.displayName),
      ),
    )
  }
  lines.push(
    el('div', {
      style: {
        color: content.displayName ? INK_SOFT : INK,
        display: 'flex',
        fontSize: content.displayName ? m.handle : m.person,
        fontWeight: content.displayName ? 600 : 800,
      },
      children: content.handle,
    }),
  )
  return el('div', {
    style: {
      alignItems: 'center',
      display: 'flex',
      flexDirection: rtl ? 'row-reverse' : 'row',
      flexShrink: 1,
      gap: m.avatar * 0.22,
    },
    children: [
      avatar(content, m),
      el('div', {
        style: {
          alignItems: rtl ? 'flex-end' : 'flex-start',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 1,
          gap: 4,
        },
        children: lines,
      }),
    ],
  })
}

/** The scannable profile code on a white, ink-outlined tile, as on the other cards. */
function qrTile(qr: string, m: Metrics): CardNode {
  return el('div', {
    style: {
      backgroundColor: PAPER,
      border: `${m.outline}px solid ${INK}`,
      borderRadius: 28,
      display: 'flex',
      flexShrink: 0,
      padding: 12,
    },
    children: [el('img', { src: qr, width: m.qr, height: m.qr })],
  })
}

export function badgeCardElement(
  content: BadgeCardContent,
  shape: CardShape,
  qr?: string,
): CardNode {
  const { width, height } = CARD_PIXELS[shape]
  const m = METRICS[shape]
  const rtl = isRtlLocale(content.locale)
  const align = rtl ? 'flex-end' : 'flex-start'
  const frame = {
    backgroundColor: GROUND[content.kind],
    display: 'flex',
    height,
    overflow: 'hidden',
    position: 'relative',
    width,
  } as const

  if (shape === 'story') {
    const inner = width - m.pad * 2
    return el('div', {
      style: {
        ...frame,
        alignItems: align,
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: `${m.pad}px ${m.pad}px`,
      },
      children: [
        brand(m, rtl),
        el('div', {
          style: { display: 'flex', justifyContent: 'center', width: inner },
          children: [hero(content, m)],
        }),
        title(content, inner, m, rtl),
        el('div', {
          style: {
            alignItems: 'center',
            display: 'flex',
            flexDirection: rtl ? 'row-reverse' : 'row',
            gap: 32,
            justifyContent: 'space-between',
            width: inner,
          },
          children: [person(content, m, rtl), ...(qr ? [qrTile(qr, m)] : [])],
        }),
      ],
    })
  }

  if (shape === 'square') {
    // The story's order, tighter, with the mark moved down beside the face:
    // side by side, the words had a third of the card and the names shrank
    // to fit it.
    const inner = width - m.pad * 2
    return el('div', {
      style: {
        ...frame,
        alignItems: align,
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: m.pad,
      },
      children: [
        el('div', {
          style: { display: 'flex', justifyContent: 'center', width: inner },
          children: [hero(content, m)],
        }),
        title(content, inner, m, rtl),
        el('div', {
          style: {
            alignItems: 'center',
            display: 'flex',
            flexDirection: rtl ? 'row-reverse' : 'row',
            justifyContent: 'space-between',
            width: inner,
          },
          children: [person(content, m, rtl), brand(m, rtl)],
        }),
      ],
    })
  }

  // Wide: the patch on one side, the words on the other — the patch on the
  // left in English and on the right in Arabic, where the eye starts.
  const column = width - m.pad * 3 - m.hero
  return el('div', {
    style: {
      ...frame,
      alignItems: 'center',
      flexDirection: rtl ? 'row-reverse' : 'row',
      gap: m.pad,
      padding: m.pad,
    },
    children: [
      hero(content, m),
      el('div', {
        style: {
          alignItems: align,
          display: 'flex',
          flexDirection: 'column',
          height: height - m.pad * 2,
          justifyContent: 'space-between',
          width: column,
        },
        children: [brand(m, rtl), title(content, column, m, rtl), person(content, m, rtl)],
      }),
    ],
  })
}
