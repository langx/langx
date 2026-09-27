import { inAllCaps, isUpper, withCase } from './casing'

/**
 * Greek in Latin letters — ELOT 743 (the Greek national standard, adopted by
 * the UN), simplified the way Greek road signs and passports simplify it:
 * accents are dropped rather than carried over.
 *
 * - `αυ ευ ηυ` are `av ev iv` before a vowel or a voiced consonant and
 *   `af ef if` before a voiceless one or at the end; `ου` is `ou`.
 * - `γγ γξ γχ` are `ng nx nch`.
 * - Where ELOT's letters would mislead a learner about the sound, the spoken
 *   form wins: `μπ ντ γκ` are `b d g` at the start of a word and `mb nd ng`
 *   inside one (`μπαμπάς` is `bampas` in ELOT and *babas* aloud; here it is
 *   `bambas`). This is the only deliberate departure from the standard.
 * - A diaeresis breaks a pair: `ευ` is a digraph, `εϋ` is `ey`.
 *
 * Polytonic text is reduced to its base letters through `normalize('NFD')`
 * where the engine has it; an engine without it leaves polytonic letters as
 * they are, which is where a monotonic chat message never goes.
 */
export function isGreek(ch: string): boolean {
  const code = ch.charCodeAt(0)
  return (code >= 0x0370 && code <= 0x03ff) || (code >= 0x1f00 && code <= 0x1fff)
}

const MONOTONIC: Record<string, [string, boolean]> = {
  ά: ['α', false],
  έ: ['ε', false],
  ή: ['η', false],
  ί: ['ι', false],
  ό: ['ο', false],
  ύ: ['υ', false],
  ώ: ['ω', false],
  ϊ: ['ι', true],
  ϋ: ['υ', true],
  ΐ: ['ι', true],
  ΰ: ['υ', true],
  ς: ['σ', false],
}

const LETTERS: Record<string, string> = {
  α: 'a',
  β: 'v',
  γ: 'g',
  δ: 'd',
  ε: 'e',
  ζ: 'z',
  η: 'i',
  θ: 'th',
  ι: 'i',
  κ: 'k',
  λ: 'l',
  μ: 'm',
  ν: 'n',
  ξ: 'x',
  ο: 'o',
  π: 'p',
  ρ: 'r',
  σ: 's',
  τ: 't',
  υ: 'y',
  φ: 'f',
  χ: 'ch',
  ψ: 'ps',
  ω: 'o',
}

const VOICELESS = 'θκξπστφχψ'

/** The base letter, lowercased and unaccented, and whether it had a diaeresis. */
function base(ch: string): [string, boolean] {
  const lower = ch.toLowerCase()
  if (LETTERS[lower] !== undefined) return [lower, false]
  const mono = MONOTONIC[lower]
  if (mono) return mono
  try {
    const decomposed = lower.normalize('NFD')
    const letter = decomposed[0] ?? lower
    if (LETTERS[letter] !== undefined) return [letter, decomposed.includes('̈')]
  } catch {
    // An engine without `normalize`: leave the letter alone, see above.
  }
  return [lower, false]
}

export function romanizeGreek(text: string): string {
  const chars = [...text]
  const letters = chars.map((ch) => (isGreek(ch) ? base(ch) : null))
  const at = (i: number) => letters[i]?.[0]
  let out = ''
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!
    const b = at(i)
    if (b === undefined) {
      out += ch === ';' ? '?' : ch
      continue
    }
    const next = at(i + 1)
    const nextPlain = next !== undefined && letters[i + 1]?.[1] === false
    const wordStart = at(i - 1) === undefined
    let latin: string
    let width = 1
    if ((b === 'α' || b === 'ε' || b === 'η') && next === 'υ' && nextPlain) {
      const after = at(i + 2)
      const voiceless = after === undefined || VOICELESS.includes(after)
      latin = LETTERS[b]! + (voiceless ? 'f' : 'v')
      width = 2
    } else if (b === 'ο' && next === 'υ' && nextPlain) {
      latin = 'ou'
      width = 2
    } else if (b === 'γ' && next === 'γ') {
      latin = 'ng'
      width = 2
    } else if (b === 'γ' && next === 'κ') {
      latin = wordStart ? 'g' : 'ng'
      width = 2
    } else if (b === 'γ' && next === 'ξ') {
      latin = 'nx'
      width = 2
    } else if (b === 'γ' && next === 'χ') {
      latin = 'nch'
      width = 2
    } else if (b === 'μ' && next === 'π') {
      latin = wordStart ? 'b' : 'mb'
      width = 2
    } else if (b === 'ν' && next === 'τ') {
      latin = wordStart ? 'd' : 'nd'
      width = 2
    } else {
      const plain = LETTERS[b]
      if (plain === undefined) {
        out += ch
        continue
      }
      latin = plain
    }
    out += withCase(latin, isUpper(ch), inAllCaps(chars, i))
    i += width - 1
  }
  return out
}
