import { isRtlLocale, type CardShape, type Locale } from '@langx/shared'
import { avatar, brand, HUES, INK, INK_SOFT, pill, qrTile } from './badgeDesign'
import { el, fitSize, PAPER, RTL_LETTER, textLine } from './recapDesign'
import { CARD_PIXELS, type CardNode } from './render'

/**
 * The owner's own profile, drawn as a card: Share profile and Invite.
 *
 * Both used to send a sentence and a link. A link to a person is the one
 * share where a picture does the most work — a story is watched on one phone
 * and scanned with another — so this is the badge card's language turned to
 * the person: their colour for the ground, a white ink-outlined block with
 * their face, name and handle, what they speak and learn, one yellow pill
 * with the invitation, and the code, big enough to scan off a screen.
 *
 * **What is not on it, deliberately**: age, city, photos beyond the one face
 * they chose, numbers. The same line `getSharedProfile` draws for the open
 * internet, and less.
 */

export interface ProfileCardContent {
  /** The owner's display name, or nothing when it cannot be drawn (see `drawableName`). */
  displayName?: string
  /** With its `@`. */
  handle: string
  /** A PNG or JPEG data URI, or nothing — then the handle's initial. */
  avatar?: string
  /** The pill: "Practise languages with me". */
  invitation: string
  /** "Turkish → learning English", or nothing. */
  languages?: string
  /** The owner's own partner hue, as the Share page draws it. */
  ground: string
  locale: Locale
}

/** The partner hues in `PARTNER_HUES` order (`apps/mobile/src/lib/theme/tokens.ts`). */
export const PROFILE_GROUNDS: readonly string[] = Object.values(HUES)

interface Metrics {
  pad: number
  outline: number
  mark: number
  wordmark: number
  kicker: number
  avatar: number
  name: number
  handle: number
  languages: number
  qr: number
  link: number
}

const METRICS: Record<CardShape, Metrics> = {
  story: {
    pad: 88,
    outline: 8,
    mark: 84,
    wordmark: 54,
    kicker: 50,
    avatar: 340,
    name: 112,
    handle: 50,
    languages: 44,
    qr: 340,
    link: 44,
  },
  square: {
    pad: 64,
    outline: 6,
    mark: 60,
    wordmark: 40,
    kicker: 36,
    avatar: 300,
    name: 84,
    handle: 38,
    languages: 32,
    qr: 240,
    link: 34,
  },
  wide: {
    pad: 52,
    outline: 6,
    mark: 52,
    wordmark: 34,
    kicker: 26,
    avatar: 250,
    name: 72,
    handle: 30,
    languages: 26,
    qr: 220,
    link: 26,
  },
}

/** The name, the handle and the languages, one under the other. */
function who(
  content: ProfileCardContent,
  width: number,
  m: Metrics,
  rtl: boolean,
  align: 'center' | 'start',
): CardNode {
  const alignItems = align === 'center' ? 'center' : rtl ? 'flex-end' : 'flex-start'
  const lines: CardNode[] = []
  if (content.displayName) {
    // An Arabic name on an English card still goes word by word: left to
    // satori's own bidi it loses its spaces.
    const wordByWord = rtl || RTL_LETTER.test(content.displayName)
    lines.push(
      textLine(
        content.displayName,
        {
          color: INK,
          // One line while it fits at a size that reads; a longer name wraps
          // at that size rather than shrinking to nothing on one line.
          fontSize: Math.max(fitSize(content.displayName, width, m.name, 0.56), m.name * 0.6),
          fontWeight: 900,
          letterSpacing: '-0.03em',
          lineHeight: 1.15,
          textAlign: align === 'center' ? 'center' : rtl ? 'right' : 'left',
        },
        wordByWord,
        width,
        align === 'center',
      ),
    )
  }
  lines.push(
    el('div', {
      style: {
        color: content.displayName ? INK_SOFT : INK,
        display: 'flex',
        fontSize: content.displayName ? m.handle : m.name,
        fontWeight: content.displayName ? 600 : 900,
      },
      children: content.handle,
    }),
  )
  if (content.languages) {
    lines.push(
      textLine(
        content.languages,
        { color: INK, fontSize: m.languages, fontWeight: 800 },
        rtl,
        width,
        align === 'center',
      ),
    )
  }
  return el('div', {
    style: {
      alignItems,
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 1,
      gap: m.handle * 0.3,
      width,
    },
    children: lines,
  })
}

/** The white block every shape carries: the person. */
function block(children: CardNode[], m: Metrics, style: Record<string, unknown>): CardNode {
  return el('div', {
    style: {
      alignItems: 'center',
      backgroundColor: PAPER,
      border: `${m.outline}px solid ${INK}`,
      borderRadius: m.avatar * 0.22,
      display: 'flex',
      flexShrink: 0,
      ...style,
    },
    children,
  })
}

/** The code and the address under it: where a stranger goes from the card. */
function code(content: ProfileCardContent, qr: string | undefined, m: Metrics): CardNode {
  return el('div', {
    style: {
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      gap: m.link * 0.4,
    },
    children: [
      ...(qr ? [qrTile(qr, m)] : []),
      el('div', {
        style: { color: INK, display: 'flex', fontSize: m.link, fontWeight: 800 },
        children: `langx.io/${content.handle.replace(/^@/, '')}`,
      }),
    ],
  })
}

export function profileCardElement(
  content: ProfileCardContent,
  shape: CardShape,
  qr?: string,
): CardNode {
  const { width, height } = CARD_PIXELS[shape]
  const m = METRICS[shape]
  const rtl = isRtlLocale(content.locale)
  const frame = {
    backgroundColor: content.ground,
    display: 'flex',
    height,
    overflow: 'hidden',
    position: 'relative',
    width,
  } as const
  const invitation = pill(content.invitation, content.locale, m, rtl, false)

  if (shape === 'story') {
    const inner = width - m.pad * 2
    return el('div', {
      style: {
        ...frame,
        alignItems: 'center',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: m.pad,
      },
      children: [
        brand(m, rtl),
        block([avatar(content, m), who(content, inner - 144, m, rtl, 'center')], m, {
          flexDirection: 'column',
          gap: 36,
          padding: 72,
          width: inner,
        }),
        invitation,
        code(content, qr, m),
      ],
    })
  }

  const row = rtl ? 'row-reverse' : 'row'
  if (shape === 'square') {
    const inner = width - m.pad * 2
    const pad = 52
    return el('div', {
      style: {
        ...frame,
        alignItems: rtl ? 'flex-end' : 'flex-start',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: m.pad,
      },
      children: [
        block(
          [avatar(content, m), who(content, inner - pad * 2 - m.avatar - 36, m, rtl, 'start')],
          m,
          { flexDirection: row, gap: 36, padding: pad, width: inner },
        ),
        invitation,
        el('div', {
          style: {
            alignItems: 'flex-end',
            display: 'flex',
            flexDirection: row,
            justifyContent: 'space-between',
            width: inner,
          },
          children: [code(content, qr, m), brand(m, rtl)],
        }),
      ],
    })
  }

  // Wide: the person on one side, the invitation and the code on the other.
  const side = 384
  const blockWidth = width - m.pad * 3 - side
  const pad = 40
  return el('div', {
    style: {
      ...frame,
      alignItems: 'center',
      flexDirection: row,
      gap: m.pad,
      padding: m.pad,
    },
    children: [
      block(
        [avatar(content, m), who(content, blockWidth - pad * 2 - m.avatar - 32, m, rtl, 'start')],
        m,
        { alignSelf: 'stretch', flexDirection: row, gap: 32, padding: pad, width: blockWidth },
      ),
      el('div', {
        style: {
          alignItems: 'center',
          display: 'flex',
          flexDirection: 'column',
          height: height - m.pad * 2,
          justifyContent: 'space-between',
          width: side,
        },
        children: [brand(m, rtl), invitation, code(content, qr, m)],
      }),
    ],
  })
}
