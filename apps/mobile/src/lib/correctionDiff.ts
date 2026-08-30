/**
 * What actually changed between a sentence and its correction.
 *
 * The old shape struck the whole original through, which says "this was wrong"
 * about a sentence that was mostly right — and hides the one thing the reader
 * is there for, which is *what* was wrong. So: a word-level diff, drawn as two
 * lines where only the differing parts carry a colour.
 *
 * Pure and free of `react-native`, so vitest can load it (see
 * `vitest.config.ts` and the mobile test notes) and so the two things that are
 * easy to get wrong — which words moved, and whether the pieces still add up
 * to the original text — are testable without a renderer.
 */

/** A run of text drawn as one `<Text>`. `changed` is the coloured half. */
export interface DiffSegment {
  text: string
  changed: boolean
}

export interface CorrectionDiff {
  /** Segments that join back to exactly the original string. */
  original: DiffSegment[]
  /** Segments that join back to exactly the corrected string. */
  corrected: DiffSegment[]
}

/**
 * Past this many tokens a side, the diff is dropped and each line is drawn
 * whole. The quadratic table is bounded by the 2000-character message limit,
 * but a message that is 2000 single characters is both pathological and
 * illegible as a diff — one changed run over the lot says as much.
 */
const MAX_TOKENS = 600

/**
 * How long a replaced pair may be before the character-level pass gives up.
 * The pass exists for `gidiyom → gidiyorum` and for a missing comma; running
 * it on two long sentences that happen to align 1:1 buys nothing and costs the
 * square of their length.
 */
const MAX_REFINE_CHARS = 120

export function diffCorrection(original: string, corrected: string): CorrectionDiff {
  if (original === corrected) {
    return { original: whole(original), corrected: whole(corrected) }
  }

  const a = tokenize(original)
  const b = tokenize(corrected)
  if (a.length > MAX_TOKENS || b.length > MAX_TOKENS) {
    return {
      original: [{ text: original, changed: true }],
      corrected: [{ text: corrected, changed: true }],
    }
  }

  const left: DiffSegment[] = []
  const right: DiffSegment[] = []

  for (const block of blocks(a, b)) {
    if (block.same) {
      // Pushed per side rather than once: two tokens are "the same" when their
      // words match, and one of them may still carry a newline the other does
      // not. Sharing the text here would move that newline to the wrong line.
      push(left, block.a.join(''), false)
      push(right, block.b.join(''), false)
      continue
    }

    if (refine(block, left, right)) continue

    pushRun(left, block.a)
    pushRun(right, block.b)
  }

  return { original: left, corrected: right }
}

/** One aligned stretch: either equal on both sides, or a replacement. */
interface Block {
  same: boolean
  a: string[]
  b: string[]
}

/**
 * A word plus whatever whitespace follows it, so the tokens of a string join
 * back to that exact string — the invariant the whole file rests on. Leading
 * whitespace rides on the first token for the same reason.
 */
function tokenize(text: string): string[] {
  const tokens = text.match(/\s*\S+\s*/g)
  if (tokens) return tokens
  return text.length > 0 ? [text] : []
}

/** The word inside a token, without the whitespace that surrounds it. */
function word(token: string): string {
  return token.trim()
}

function whole(text: string): DiffSegment[] {
  return text.length > 0 ? [{ text, changed: false }] : []
}

/** Appends, merging into the previous segment when it is the same kind. */
function push(into: DiffSegment[], text: string, changed: boolean): void {
  if (text.length === 0) return
  const last = into[into.length - 1]
  if (last && last.changed === changed) last.text += text
  else into.push({ text, changed })
}

/**
 * A changed run, with its trailing whitespace left out of the colour: a strike
 * through the space after a word reads as a strike through the gap between two
 * sentences, which is not what was deleted.
 */
function pushRun(into: DiffSegment[], tokens: string[]): void {
  if (tokens.length === 0) return
  const text = tokens.join('')
  const trimmed = text.trimEnd()
  push(into, trimmed, true)
  push(into, text.slice(trimmed.length), false)
}

/**
 * One word swapped for one word: mark only the letters that differ.
 *
 * This is the case Turkish spends most of its time in — a correction is
 * usually a suffix (`gidiyom` → `gidiyorum`), and colouring the whole word
 * hides which part of it was the mistake. It is also what makes the diff
 * useful for languages written without spaces, where the tokenizer produces
 * one long token per side and this is the only pass that can say anything.
 *
 * Returns false when it does not apply, leaving the caller to mark the run
 * whole.
 */
function refine(block: Block, left: DiffSegment[], right: DiffSegment[]): boolean {
  if (block.a.length !== 1 || block.b.length !== 1) return false
  const tokenA = block.a[0] as string
  const tokenB = block.b[0] as string
  const wordA = word(tokenA)
  const wordB = word(tokenB)
  if (wordA.length > MAX_REFINE_CHARS || wordB.length > MAX_REFINE_CHARS) return false

  const shortest = Math.min(wordA.length, wordB.length)
  let prefix = 0
  while (prefix < shortest && wordA[prefix] === wordB[prefix]) prefix++
  let suffix = 0
  while (
    suffix < shortest - prefix &&
    wordA[wordA.length - 1 - suffix] === wordB[wordB.length - 1 - suffix]
  ) {
    suffix++
  }

  // Nothing in common worth keeping: two different words rather than one word
  // edited, and splitting them into letters would only be noise.
  if (prefix === 0 && suffix === 0) return false

  const leadA = tokenA.slice(0, tokenA.indexOf(wordA))
  const leadB = tokenB.slice(0, tokenB.indexOf(wordB))
  push(left, leadA + wordA.slice(0, prefix), false)
  push(right, leadB + wordB.slice(0, prefix), false)
  push(left, wordA.slice(prefix, wordA.length - suffix), true)
  push(right, wordB.slice(prefix, wordB.length - suffix), true)
  push(left, wordA.slice(wordA.length - suffix) + tokenA.slice(leadA.length + wordA.length), false)
  push(right, wordB.slice(wordB.length - suffix) + tokenB.slice(leadB.length + wordB.length), false)
  return true
}

/**
 * The alignment itself: a longest-common-subsequence over words, walked back
 * into alternating equal and replaced blocks.
 *
 * Words rather than characters because a correction is edited in words, and a
 * character diff of two sentences produces a confetti of one-letter runs that
 * nobody can read. The character pass above is the deliberate exception.
 */
function blocks(a: string[], b: string[]): Block[] {
  const keysA = a.map(word)
  const keysB = b.map(word)
  const n = a.length
  const m = b.length
  const width = m + 1
  // Uint16 is enough: the table counts tokens, and `MAX_TOKENS` caps them well
  // below 65535.
  const table = new Uint16Array((n + 1) * width)

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * width + j] =
        keysA[i] === keysB[j]
          ? (table[(i + 1) * width + j + 1] as number) + 1
          : Math.max(table[(i + 1) * width + j] as number, table[i * width + j + 1] as number)
    }
  }

  const result: Block[] = []
  let i = 0
  let j = 0
  while (i < n || j < m) {
    if (i < n && j < m && keysA[i] === keysB[j]) {
      const runA: string[] = []
      const runB: string[] = []
      while (i < n && j < m && keysA[i] === keysB[j]) {
        runA.push(a[i++] as string)
        runB.push(b[j++] as string)
      }
      result.push({ same: true, a: runA, b: runB })
      continue
    }

    const runA: string[] = []
    const runB: string[] = []
    while (i < n || j < m) {
      if (i < n && j < m && keysA[i] === keysB[j]) break
      if (
        j >= m ||
        (i < n && (table[(i + 1) * width + j] as number) >= (table[i * width + j + 1] as number))
      ) {
        runA.push(a[i++] as string)
      } else {
        runB.push(b[j++] as string)
      }
    }
    result.push({ same: false, a: runA, b: runB })
  }
  return result
}
