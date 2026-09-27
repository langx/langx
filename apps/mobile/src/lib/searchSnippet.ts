/** A half-open `[start, end)` span of a string. */
export interface MatchRange {
  start: number
  end: number
}

/** A run of text, and whether it is part of what was searched for. */
export interface SnippetPart {
  text: string
  match: boolean
}

/** How much of the sentence to keep ahead of the first match. */
const LEAD = 24

/**
 * Where `term` occurs in `text`, ignoring case.
 *
 * `indexOf`, never a `RegExp` built from the term: what somebody types in a
 * search box is not a pattern, and a pattern built from it is one they can
 * make the device spend its time failing to match.
 *
 * Lower-casing is only a fair comparison while it keeps every character the
 * same length — `'İ'.toLowerCase()` is two code units, which would shift every
 * offset after it. Then nothing is highlighted rather than the wrong letters:
 * the server found the message, and the row still shows it.
 */
export function matchRanges(text: string, term: string): MatchRange[] {
  const needle = term.toLowerCase()
  const haystack = text.toLowerCase()
  if (needle.length === 0 || haystack.length !== text.length) return []

  const ranges: MatchRange[] = []
  let from = 0
  for (;;) {
    const at = haystack.indexOf(needle, from)
    if (at < 0) break
    ranges.push({ start: at, end: at + needle.length })
    from = at + needle.length
  }
  return ranges
}

/**
 * One search result's line: the message from a little before its first match,
 * cut into the runs to draw plain and the runs to highlight.
 *
 * Only the lead is trimmed. The row caps its lines and the text component
 * ellipsises the tail, so cutting the end here too would only guess at a
 * width it cannot see. The lead has to be cut here, because a match forty
 * words into a paragraph would otherwise sit past the row's last line.
 *
 * Whitespace runs are folded to one space first — a message with line breaks
 * would otherwise spend the row's lines on them — and the term with them, so
 * a search the server matched across a line break still highlights.
 */
export function searchSnippet(body: string, term: string): SnippetPart[] {
  const text = body.replace(/\s+/g, ' ').trim()
  const ranges = matchRanges(text, term.replace(/\s+/g, ' ').trim())
  const first = ranges[0]

  let start = 0
  if (first && first.start > LEAD) {
    start = first.start - LEAD
    // Start on a word where there is one to start on, not halfway into it.
    const space = text.indexOf(' ', start)
    if (space >= 0 && space < first.start) start = space + 1
    // Never between the halves of a surrogate pair, which draws as a box.
    else if (isLowSurrogate(text.charCodeAt(start))) start -= 1
  }

  const parts: SnippetPart[] = []
  if (start > 0) parts.push({ text: '…', match: false })
  let at = start
  for (const range of ranges) {
    if (range.start > at) parts.push({ text: text.slice(at, range.start), match: false })
    parts.push({ text: text.slice(range.start, range.end), match: true })
    at = range.end
  }
  if (at < text.length) parts.push({ text: text.slice(at), match: false })
  return parts
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff
}
