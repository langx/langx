import { findLinks, findMentions, type FoundLink, type FoundMention } from '@langx/shared'

/**
 * One run of a message's text: plain, an address, or an `@handle`.
 *
 * `at` is where it starts in the original string, which is also a key that
 * stays put while the text around it does not change.
 */
export type LinkedPart =
  | { at: number; text: string }
  | { at: number; text: string; href: string }
  | { at: number; text: string; handle: string }

/**
 * A message cut into the runs `LinkedText` draws, or `null` when nothing in
 * it is tappable — the common case, which then renders as one plain string.
 *
 * An address wins over a mention it overlaps. `findMentions` already skips an
 * `@` inside a path, but not one in a query (`?ref=@deniz`), and a tap there
 * belongs to the address somebody pasted, not to a person it happens to name.
 */
export function linkedParts(text: string): LinkedPart[] | null {
  const links = findLinks(text)
  const mentions = findMentions(text)
  if (links.length === 0 && mentions.length === 0) return null

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

  const parts: LinkedPart[] = []
  let at = 0
  for (const mark of marks) {
    if (mark.start > at) parts.push({ at, text: text.slice(at, mark.start) })
    const cut = text.slice(mark.start, mark.end)
    parts.push(
      'href' in mark
        ? { at: mark.start, text: cut, href: mark.href }
        : { at: mark.start, text: cut, handle: mark.handle },
    )
    at = mark.end
  }
  if (at < text.length) parts.push({ at, text: text.slice(at) })
  return parts
}
