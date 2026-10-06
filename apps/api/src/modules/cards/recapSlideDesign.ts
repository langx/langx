import { isRtlLocale, type CalendarDay, type CardShape, type RecapSlide } from '@langx/shared'
import {
  BLUE,
  INK,
  MARK_SRC,
  METRICS,
  ON_YELLOW,
  PAPER,
  YELLOW,
  brand,
  disc,
  el,
  fitSize,
  headline,
  owner,
  site,
  textLine,
  type Ink,
  type Metrics,
  type RecapCardContent,
} from './recapDesign'
import { CARD_PIXELS, loadBadge, type CardNode } from './render'

/**
 * One slide of "Your Month", drawn as a card of its own.
 *
 * The summary is the poster in `recapDesign.ts`; every other slide is one
 * number on the slide's own ground — the colours the story showed it in — so
 * the card somebody posts is the slide they chose to post, not a different
 * picture of the same month. The intro has no number and is the month's name.
 */

export type SlideCard = Exclude<RecapSlide, 'summary'>

export interface RecapSlideContent extends Pick<
  RecapCardContent,
  'month' | 'year' | 'kicker' | 'people' | 'handle' | 'languages' | 'avatar' | 'locale'
> {
  slide: SlideCard
  /** The slide's number, formatted for the locale; absent on the intro. */
  value?: string
  /** What the number counts, in the plural form for it. */
  label?: string
  /** The streak slide's calendar for a month: one square per day. */
  days?: CalendarDay[]
  /** The streak slide's calendar for a year: one square per month, shaded 0–1. */
  months?: number[]
}

// From `apps/mobile/src/lib/theme/tokens.ts`, light scheme, as the story uses
// them: the grounds are the brand's colours in both schemes.
const GREEN = '#009f70'
const ORANGE = '#f79009'
const ON_YELLOW_SOFT = 'rgba(32, 25, 0, 0.62)'

interface Look {
  ground: string
  numeral: string
  /** The decoration bled off the top corner, or none. */
  disc?: string
  ink: Ink
}

const ON_COLOUR: Omit<Ink, 'chipText'> = {
  text: PAPER,
  kicker: 'rgba(255, 255, 255, 0.8)',
  soft: 'rgba(255, 255, 255, 0.88)',
  mark: MARK_SRC,
  chip: PAPER,
}

const ON_LIGHT: Ink = {
  text: ON_YELLOW,
  kicker: ON_YELLOW_SOFT,
  soft: ON_YELLOW_SOFT,
  mark: MARK_SRC,
  chip: PAPER,
  chipText: ON_YELLOW,
}

/**
 * Each slide's ground, as `slideLook` in the app has it. The Echo slide is
 * white, where the arcs' white half would vanish, so it takes the yellow tile.
 */
async function lookFor(slide: SlideCard): Promise<Look> {
  switch (slide) {
    case 'intro':
      return { ground: YELLOW, numeral: ON_YELLOW, disc: BLUE, ink: ON_LIGHT }
    case 'messages':
      return {
        ground: BLUE,
        numeral: PAPER,
        disc: YELLOW,
        ink: { ...ON_COLOUR, chipText: BLUE },
      }
    case 'corrections':
      return {
        ground: GREEN,
        numeral: PAPER,
        disc: YELLOW,
        ink: { ...ON_COLOUR, chipText: GREEN },
      }
    case 'echo':
      return {
        ground: PAPER,
        numeral: BLUE,
        disc: YELLOW,
        ink: {
          text: INK,
          kicker: 'rgba(23, 25, 28, 0.6)',
          soft: 'rgba(23, 25, 28, 0.72)',
          mark: await loadBadge(),
          chip: BLUE,
          chipText: PAPER,
        },
      }
    case 'streak':
      // Dark ink on the orange, as on the slide: white on it fails contrast.
      // No disc — the calendar is this card's picture.
      return { ground: ORANGE, numeral: ON_YELLOW, ink: ON_LIGHT }
  }
}

/** Squares of the calendar in the slide's colours, as `StreakSlide` draws them. */
function squareColours(content: RecapSlideContent): string[] {
  if (content.months) {
    return content.months.map((share) =>
      share > 0 ? `rgba(32, 25, 0, ${(0.25 + 0.75 * share).toFixed(2)})` : 'rgba(32, 25, 0, 0.1)',
    )
  }
  const fill = {
    streak: ON_YELLOW,
    active: 'rgba(32, 25, 0, 0.32)',
    idle: 'rgba(32, 25, 0, 0.1)',
  } as const
  return (content.days ?? []).map((day) => fill[day])
}

/** A week a row for a month, two rows of six for a year. */
function calendar(content: RecapSlideContent, cell: number, rtl: boolean): CardNode | null {
  const squares = squareColours(content)
  if (squares.length === 0) return null
  const columns = content.months ? 6 : 7
  const gap = Math.round(cell * 0.2)
  const rows: string[][] = []
  for (let at = 0; at < squares.length; at += columns) rows.push(squares.slice(at, at + columns))
  return el('div', {
    style: { display: 'flex', flexDirection: 'column', flexShrink: 0, gap },
    children: rows.map((row) =>
      el('div', {
        style: { display: 'flex', flexDirection: rtl ? 'row-reverse' : 'row', gap },
        children: row.map((colour) =>
          el('div', {
            style: {
              backgroundColor: colour,
              borderRadius: cell * 0.24,
              display: 'flex',
              height: cell,
              width: cell,
            },
          }),
        ),
      }),
    ),
  })
}

/** The number and what it counts — or nothing, on the intro. */
function figure(
  content: RecapSlideContent,
  look: Look,
  width: number,
  sizes: { number: number; label: number; people: number },
  rtl: boolean,
): CardNode[] {
  if (content.value === undefined) return []
  const nodes: CardNode[] = [
    el('div', {
      style: {
        color: look.numeral,
        display: 'flex',
        flexShrink: 0,
        fontSize: fitSize(content.value, width, sizes.number, 0.56),
        fontWeight: 900,
        letterSpacing: '-0.05em',
        lineHeight: 1,
      },
      children: content.value,
    }),
  ]
  if (content.label) {
    nodes.push(
      textLine(
        content.label,
        { color: look.ink.text, fontSize: sizes.label, fontWeight: 800, lineHeight: 1.15 },
        rtl,
        width,
      ),
    )
  }
  // On the messages slide the people are part of the number's sentence; on
  // the intro they stay under the month, where `headline` puts them.
  if (content.slide === 'messages' && content.people && sizes.people > 0) {
    nodes.push(
      textLine(
        content.people,
        { color: look.ink.soft, fontSize: sizes.people, fontWeight: 600 },
        rtl,
        width,
      ),
    )
  }
  return nodes
}

/**
 * The kicker and the month: the whole headline on the intro, a line above the
 * number everywhere else.
 */
function slideHeadline(
  content: RecapSlideContent,
  width: number,
  m: Metrics,
  month: number,
  rtl: boolean,
  ink: Ink,
): CardNode {
  const intro = content.slide === 'intro'
  return headline(
    {
      kicker: content.kicker,
      locale: content.locale,
      month: content.month,
      ...(content.year ? { year: content.year } : {}),
      ...(intro && content.people ? { people: content.people } : {}),
    },
    width,
    // The square poster has no room for the people line; the intro card,
    // with nothing else on it, does.
    { ...m, month, people: m.people || 30 },
    rtl,
    ink,
  )
}

function column(align: string, gap: number, children: CardNode[], extra = {}): CardNode {
  return el('div', {
    style: { alignItems: align, display: 'flex', flexDirection: 'column', gap, ...extra },
    children,
  })
}

export async function recapSlideElement(
  content: RecapSlideContent,
  shape: CardShape,
  qr?: string,
): Promise<CardNode> {
  const { width, height } = CARD_PIXELS[shape]
  const m = METRICS[shape]
  const look = await lookFor(content.slide)
  const rtl = isRtlLocale(content.locale)
  const align = rtl ? 'flex-end' : 'flex-start'
  const row = rtl ? 'row-reverse' : 'row'
  const intro = content.slide === 'intro'
  const frame = {
    backgroundColor: look.ground,
    display: 'flex',
    flexDirection: 'column',
    height,
    overflow: 'hidden',
    position: 'relative',
    width,
  } as const
  const discs = (size: number, offset: number): CardNode[] =>
    look.disc ? [disc(size, offset, rtl, look.disc)] : []

  if (shape === 'story') {
    const inner = width - 88 * 2
    const grid = calendar(content, 64, rtl)
    return el('div', {
      style: frame,
      children: [
        ...discs(620, 200),
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
            brand(m, rtl, look.ink),
            el('div', {
              style: { display: 'flex', marginTop: intro ? 0 : 70 },
              children: intro ? [] : [slideHeadline(content, inner, m, 120, rtl, look.ink)],
            }),
            // Everything below sits on the floor of the card, as the number
            // sits at the foot of the slide.
            column(
              align,
              28,
              [
                ...(intro ? [slideHeadline(content, inner, m, 240, rtl, look.ink)] : []),
                ...(grid
                  ? [el('div', { style: { display: 'flex', marginBottom: 36 }, children: [grid] })]
                  : []),
                ...figure(content, look, inner, { number: 420, label: 64, people: 40 }, rtl),
              ],
              { flex: 1, justifyContent: 'flex-end', width: inner },
            ),
            el('div', {
              style: {
                alignItems: 'center',
                display: 'flex',
                flexDirection: row,
                flexShrink: 0,
                gap: 32,
                justifyContent: 'space-between',
                width: inner,
              },
              children: [owner(content, m, rtl, look.ink), site(m, rtl, qr, look.ink)],
            }),
          ],
        }),
      ],
    })
  }

  if (shape === 'square') {
    const pad = 72
    const inner = width - pad * 2
    const grid = calendar(content, 40, rtl)
    // The calendar takes the top corner, so the month beside it has less room.
    const top = grid ? inner - 7 * 40 - 6 * 8 - 40 : inner
    return el('div', {
      style: frame,
      children: [
        ...discs(440, 170),
        el('div', {
          style: {
            alignItems: align,
            display: 'flex',
            flex: 1,
            flexDirection: 'column',
            gap: 36,
            padding: pad,
          },
          children: [
            brand(m, rtl, look.ink),
            el('div', {
              style: {
                alignItems: 'flex-start',
                display: 'flex',
                flexDirection: row,
                gap: 40,
                justifyContent: 'space-between',
                width: inner,
              },
              children: intro
                ? []
                : [slideHeadline(content, top, m, 96, rtl, look.ink), ...(grid ? [grid] : [])],
            }),
            column(
              align,
              16,
              intro
                ? [slideHeadline(content, inner, m, 170, rtl, look.ink)]
                : figure(content, look, inner, { number: 300, label: 46, people: 30 }, rtl),
              { flex: 1, justifyContent: 'flex-end', width: inner },
            ),
            el('div', {
              style: {
                alignItems: 'center',
                display: 'flex',
                flexDirection: row,
                flexShrink: 0,
                gap: 32,
                justifyContent: 'space-between',
                width: inner,
              },
              children: [owner(content, m, rtl, look.ink), site(m, rtl, undefined, look.ink)],
            }),
          ],
        }),
      ],
    })
  }

  // Wide: words on one half, the number on the other, as the poster does.
  const pad = 56
  const left = (width - pad * 3) * 0.46
  const right = width - pad * 3 - left
  const grid = calendar(content, 30, rtl)
  return el('div', {
    style: frame,
    children: [
      ...discs(360, 150),
      el('div', {
        style: {
          display: 'flex',
          flex: 1,
          flexDirection: row,
          gap: pad,
          padding: pad,
        },
        children: [
          column(
            align,
            24,
            [
              brand(m, rtl, look.ink),
              ...(intro ? [] : [slideHeadline(content, left, m, 72, rtl, look.ink)]),
              owner(content, m, rtl, look.ink),
            ],
            { justifyContent: 'space-between', width: left },
          ),
          column(
            align,
            14,
            intro
              ? [slideHeadline(content, right, m, 150, rtl, look.ink)]
              : [
                  ...(grid
                    ? [
                        el('div', {
                          style: { display: 'flex', marginBottom: 12 },
                          children: [grid],
                        }),
                      ]
                    : []),
                  ...figure(content, look, right, { number: 240, label: 36, people: 24 }, rtl),
                ],
            { justifyContent: 'flex-end', width: right },
          ),
        ],
      }),
    ],
  })
}
