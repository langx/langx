import { findLinks } from './links'
import { findMentions } from './mentions'

/**
 * WhatsApp-style emphasis in a chat message: `*bold*`, `_italic_`,
 * `~strikethrough~` and `||spoiler||`.
 *
 * Nothing is stored: the body keeps the markers exactly as typed, and every
 * reader works the spans out again. That keeps a quote or a correction's
 * original a substring of the message (the server checks that), keeps Copy
 * copying what was written, and lets an older build show the plain text.
 */
export type FormatStyle = 'bold' | 'italic' | 'strike' | 'spoiler'

export const FORMAT_MARKERS: Readonly<Record<FormatStyle, string>> = {
  bold: '*',
  italic: '_',
  strike: '~',
  spoiler: '||',
}

/**
 * One formatted run. `start`/`end` cover the markers too, so the text between
 * them is `text.slice(start + marker.length, end - marker.length)`.
 */
export interface FoundFormat {
  start: number
  end: number
  style: FormatStyle
}

/** What a preview shows in place of a spoiler's words, whatever their length. */
export const SPOILER_MASK = '▒▒▒'

const STYLES: readonly FormatStyle[] = ['bold', 'italic', 'strike', 'spoiler']
const MARKER_CHARS = /[*_~|]/
const WORD = /[\p{L}\p{M}\p{N}]/u
const SPACE = /\s/u
const NONE = -1

/** Whether the code point that ends just before `at` is a letter, mark or digit. */
function wordBefore(text: string, at: number): boolean {
  if (at <= 0) return false
  const low = text.charCodeAt(at - 1)
  const from = low >= 0xdc00 && low <= 0xdfff && at >= 2 ? at - 2 : at - 1
  return WORD.test(String.fromCodePoint(text.codePointAt(from)!))
}

/** Whether the code point that starts at `at` is a letter, mark or digit. */
function wordAt(text: string, at: number): boolean {
  if (at >= text.length) return false
  return WORD.test(String.fromCodePoint(text.codePointAt(at)!))
}

/*
 * One pass by hand, and no regular expression that could backtrack. The
 * obvious `\*([^*\n]+)\*` shapes are quadratic on a long run of markers with
 * no closer — each position re-reads the rest of the line — and CodeQL has
 * flagged that shape in this package before (see `sentences.ts`). Here every
 * position is classified once, the nearest closer to its right is filled in
 * by one sweep from the end, and the pairing walk never goes back.
 *
 * The rules, WhatsApp's:
 * - A marker hugs its words: `* x *` stays literal.
 * - An opener sits at the start, or after a space or punctuation; a closer at
 *   the end, or before one. So `snake_case_name` and `2*3*4` are left alone.
 * - A doubled marker (`**x**`) is neither — it reads as somebody's Markdown,
 *   and half-formatting it would leave stray asterisks either way.
 * - No span crosses a line break, and none nests: inside one, other markers
 *   are text.
 * - A marker inside an address or an `@handle` is part of it. `findLinks`
 *   and `findMentions` win, so `langx.io/a_b_c` and `@a_b_` stay whole — but
 *   a whole link can sit inside a span (`*see langx.io*`).
 */
export function findFormatting(text: string): FoundFormat[] {
  const n = text.length
  if (!MARKER_CHARS.test(text)) return []

  const taken = new Uint8Array(n)
  for (const range of [...findLinks(text), ...findMentions(text)]) {
    taken.fill(1, range.start, range.end)
  }

  const free = (from: number, length: number): boolean => {
    for (let k = from; k < from + length; k++) if (taken[k]) return false
    return true
  }
  const opensAt = (at: number, marker: string): boolean => {
    const char = marker[0]!
    const after = at + marker.length
    return (
      text.startsWith(marker, at) &&
      free(at, marker.length) &&
      text[at - 1] !== char &&
      !wordBefore(text, at) &&
      after < n &&
      text[after] !== char &&
      !SPACE.test(text[after]!)
    )
  }
  const closesAt = (at: number, marker: string): boolean => {
    const char = marker[0]!
    const after = at + marker.length
    return (
      at > 0 &&
      text.startsWith(marker, at) &&
      free(at, marker.length) &&
      text[at - 1] !== char &&
      !SPACE.test(text[at - 1]!) &&
      text[after] !== char &&
      !wordAt(text, after)
    )
  }

  // For every style, the nearest closer at or to the right of each position,
  // stopping at a line break. One sweep from the end, so the pairing below
  // looks a closer up instead of searching for it.
  const nextClose = new Map<FormatStyle, Int32Array>()
  for (const style of STYLES) {
    const marker = FORMAT_MARKERS[style]
    if (!text.includes(marker)) continue
    const next = new Int32Array(n + 1).fill(NONE)
    for (let at = n - 1; at >= 0; at--) {
      if (text[at] === '\n') next[at] = NONE
      else if (closesAt(at, marker)) next[at] = at
      else next[at] = next[at + 1]!
    }
    nextClose.set(style, next)
  }

  const found: FoundFormat[] = []
  let at = 0
  while (at < n) {
    let matched = false
    for (const [style, next] of nextClose) {
      const marker = FORMAT_MARKERS[style]
      if (!opensAt(at, marker)) continue
      // `opensAt` refused a marker followed by its own character, so the
      // closer found here is past the opener and the words are not empty.
      const close = next[at + marker.length]!
      if (close === NONE) continue
      const end = close + marker.length
      found.push({ start: at, end, style })
      at = end
      matched = true
      break
    }
    if (!matched) at++
  }
  return found
}

/**
 * A message's text for a one-line preview — the chat list, a push, a reply
 * quote: the markers go, and a spoiler's words become `SPOILER_MASK`, since
 * a preview has nowhere to tap it open and printing it would give it away.
 */
export function stripFormatting(text: string): string {
  const spans = findFormatting(text)
  if (spans.length === 0) return text
  let out = ''
  let at = 0
  for (const span of spans) {
    const length = FORMAT_MARKERS[span.style].length
    out += text.slice(at, span.start)
    out +=
      span.style === 'spoiler' ? SPOILER_MASK : text.slice(span.start + length, span.end - length)
    at = span.end
  }
  return out + text.slice(at)
}
