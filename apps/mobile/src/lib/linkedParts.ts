import {
  findFormatting,
  findLinks,
  findMentions,
  FORMAT_MARKERS,
  type FormatStyle,
  type FoundLink,
  type FoundMention,
} from '@langx/shared'

/** The emphasis a run is drawn with. A spoiler is not one: it groups runs. */
export type Emphasis = Exclude<FormatStyle, 'spoiler'>

/**
 * One run of a message's text: plain, an address, or an `@handle`, each
 * possibly in bold, italic or struck through.
 *
 * `at` is where it starts in the original string, which is also a key that
 * stays put while the text around it does not change.
 */
export type LinkedRun =
  | { at: number; text: string; style?: Emphasis }
  | { at: number; text: string; href: string; style?: Emphasis }
  | { at: number; text: string; handle: string; style?: Emphasis }

/**
 * A run, or a `||spoiler||` holding the runs it hides. The spoiler's `at` is
 * where its opening marker was, so it keeps a key of its own.
 */
export type LinkedPart = LinkedRun | { at: number; spoiler: LinkedRun[] }

/**
 * A message cut into the runs `LinkedText` draws, or `null` when nothing in
 * it is tappable or formatted — the common case, which then renders as one
 * plain string.
 *
 * An address wins over a mention it overlaps. `findMentions` already skips an
 * `@` inside a path, but not one in a query (`?ref=@deniz`), and a tap there
 * belongs to the address somebody pasted, not to a person it happens to name.
 *
 * The markers themselves are dropped. `findFormatting` never puts one inside
 * an address or a mention, so every link sits wholly inside a span or wholly
 * outside it, and one cursor over the links serves the whole message.
 */
export function linkedParts(text: string): LinkedPart[] | null {
  const links = findLinks(text)
  const mentions = findMentions(text)
  const formats = findFormatting(text)
  if (links.length === 0 && mentions.length === 0 && formats.length === 0) return null

  // Both lists are in order and neither overlaps itself, so one cursor over
  // the links is enough to find the one each mention could collide with.
  const marks: (FoundLink | FoundMention)[] = [...links]
  let cursor = 0
  for (const mention of mentions) {
    while (cursor < links.length && (links[cursor]?.end ?? 0) <= mention.start) cursor++
    const next = links[cursor]
    if (next && next.start < mention.end) continue
    marks.push(mention)
  }
  marks.sort((a, b) => a.start - b.start)

  let next = 0
  const runs = (from: number, to: number, style?: Emphasis): LinkedRun[] => {
    const styled = style ? { style } : {}
    const out: LinkedRun[] = []
    let at = from
    for (let mark = marks[next]; mark && mark.start < to; mark = marks[++next]) {
      if (mark.start > at) out.push({ at, text: text.slice(at, mark.start), ...styled })
      const cut = text.slice(mark.start, mark.end)
      out.push(
        'href' in mark
          ? { at: mark.start, text: cut, href: mark.href, ...styled }
          : { at: mark.start, text: cut, handle: mark.handle, ...styled },
      )
      at = mark.end
    }
    if (at < to) out.push({ at, text: text.slice(at, to), ...styled })
    return out
  }

  const parts: LinkedPart[] = []
  let at = 0
  for (const format of formats) {
    parts.push(...runs(at, format.start))
    const length = FORMAT_MARKERS[format.style].length
    const from = format.start + length
    const to = format.end - length
    if (format.style === 'spoiler') parts.push({ at: format.start, spoiler: runs(from, to) })
    else parts.push(...runs(from, to, format.style))
    at = format.end
  }
  parts.push(...runs(at, text.length))
  return parts
}
