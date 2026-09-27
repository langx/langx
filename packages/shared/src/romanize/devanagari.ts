/**
 * Hindi in Latin letters, the way Hindi speakers write it in a chat — a
 * Hunterian base without its diacritics, long vowels doubled so that they
 * still show: `aa ee oo` for `ā ī ū`, shortened again at the end of a word
 * where nothing could be confused with them (`मेरा` `mera`, `हिंदी` `hindi`).
 * Retroflex and dental are not told apart (`ट` and `त` are both `t`), which is
 * the price of no diacritics.
 *
 * **The inherent vowel.** Every consonant carries an `a` in the script and
 * Hindi drops many of them aloud; this is where a rule cannot be perfect. Two
 * heuristics, applied right to left:
 *
 * - A word's last `a` is dropped (`राम` `ram`) unless the word is one letter
 *   (`न` `na`) or ends in a conjunct whose last consonant is `र य व`
 *   (`मित्र` `mitra`, `कार्य` `kaarya`).
 * - A medial `a` is dropped between two sounded vowels when the consonant
 *   after it is not a conjunct (`कमला` `kamla`, `समझना` `samajhna`), and never
 *   in two neighbouring syllables.
 *
 * Words that break these — mostly Sanskrit loans that keep a final `a`, and
 * compounds — come out one vowel off. Anusvara is `m` before `p ph b bh m` and
 * `n` elsewhere; chandrabindu is `n`. Marathi and Nepali share the script and
 * mostly read acceptably, but the heuristics are Hindi's.
 */
export function isDevanagari(ch: string): boolean {
  const code = ch.charCodeAt(0)
  return code >= 0x0900 && code <= 0x097f
}

const CONSONANTS: Record<number, string> = {
  0x0915: 'k',
  0x0916: 'kh',
  0x0917: 'g',
  0x0918: 'gh',
  0x0919: 'n',
  0x091a: 'ch',
  0x091b: 'chh',
  0x091c: 'j',
  0x091d: 'jh',
  0x091e: 'n',
  0x091f: 't',
  0x0920: 'th',
  0x0921: 'd',
  0x0922: 'dh',
  0x0923: 'n',
  0x0924: 't',
  0x0925: 'th',
  0x0926: 'd',
  0x0927: 'dh',
  0x0928: 'n',
  0x0929: 'n',
  0x092a: 'p',
  0x092b: 'ph',
  0x092c: 'b',
  0x092d: 'bh',
  0x092e: 'm',
  0x092f: 'y',
  0x0930: 'r',
  0x0931: 'r',
  0x0932: 'l',
  0x0933: 'l',
  0x0934: 'l',
  0x0935: 'v',
  0x0936: 'sh',
  0x0937: 'sh',
  0x0938: 's',
  0x0939: 'h',
  // Precomposed nukta letters: the Persian and Arabic sounds.
  0x0958: 'q',
  0x0959: 'kh',
  0x095a: 'gh',
  0x095b: 'z',
  0x095c: 'r',
  0x095d: 'rh',
  0x095e: 'f',
  0x095f: 'y',
}

/** A consonant followed by a combining nukta. */
const NUKTA: Record<number, [number, string]> = {
  0x0915: [0x0958, 'q'],
  0x0916: [0x0959, 'kh'],
  0x0917: [0x095a, 'gh'],
  0x091c: [0x095b, 'z'],
  0x0921: [0x095c, 'r'],
  0x0922: [0x095d, 'rh'],
  0x092b: [0x095e, 'f'],
  0x092f: [0x095f, 'y'],
}

const VOWELS: Record<number, string> = {
  0x0905: 'a',
  0x0906: 'aa',
  0x0907: 'i',
  0x0908: 'ee',
  0x0909: 'u',
  0x090a: 'oo',
  0x090b: 'ri',
  0x090c: 'li',
  0x090d: 'e',
  0x090e: 'e',
  0x090f: 'e',
  0x0910: 'ai',
  0x0911: 'o',
  0x0912: 'o',
  0x0913: 'o',
  0x0914: 'au',
  0x0960: 'ri',
  0x0961: 'li',
  0x0950: 'om',
}

const MATRAS: Record<number, string> = {
  0x093e: 'aa',
  0x093f: 'i',
  0x0940: 'ee',
  0x0941: 'u',
  0x0942: 'oo',
  0x0943: 'ri',
  0x0944: 'ri',
  0x0945: 'e',
  0x0946: 'e',
  0x0947: 'e',
  0x0948: 'ai',
  0x0949: 'o',
  0x094a: 'o',
  0x094b: 'o',
  0x094c: 'au',
  0x0962: 'li',
  0x0963: 'li',
}

const NUKTA_SIGN = 0x093c
const VIRAMA = 0x094d
const CHANDRABINDU = 0x0901
const ANUSVARA = 0x0902
const VISARGA = 0x0903
const ZWNJ = 0x200c
const ZWJ = 0x200d

/** Consonants a following anusvara is said as `m` before. */
const LABIALS = new Set([0x092a, 0x092b, 0x092c, 0x092d, 0x092e])
/** A final conjunct ending in one of these keeps its `a`. */
const KEEPS_FINAL_A = new Set([0x0930, 0x092f, 0x0935])

/** Danda, double danda, abbreviation sign; the digits are handled apart. */
const PUNCTUATION: Record<number, string> = { 0x0964: '.', 0x0965: '.', 0x0970: '.' }

interface Unit {
  romans: string[]
  codes: number[]
  /** An explicit vowel: a matra or an independent letter. */
  vowel: string | null
  /** Still carries the script's `a` — no matra, no virama. */
  inherent: boolean
  /** Anusvara or chandrabindu (`N`), visarga (`h`). */
  tail: '' | 'N' | 'h'
}

function romanizeWord(codes: number[]): string {
  const units: Unit[] = []
  let joining = false
  for (const code of codes) {
    const current = units[units.length - 1]
    const consonant = CONSONANTS[code]
    if (consonant !== undefined) {
      if (joining && current) {
        current.romans.push(consonant)
        current.codes.push(code)
        current.inherent = true
      } else {
        units.push({ romans: [consonant], codes: [code], vowel: null, inherent: true, tail: '' })
      }
      joining = false
    } else if (code === NUKTA_SIGN) {
      const last = current?.codes[current.codes.length - 1]
      const swap = last === undefined ? undefined : NUKTA[last]
      if (current && swap) {
        current.codes[current.codes.length - 1] = swap[0]
        current.romans[current.romans.length - 1] = swap[1]
      }
    } else if (code === VIRAMA) {
      if (current) current.inherent = false
      joining = true
    } else if (MATRAS[code] !== undefined) {
      if (current) {
        current.vowel = MATRAS[code]
        current.inherent = false
      }
      joining = false
    } else if (VOWELS[code] !== undefined) {
      units.push({ romans: [], codes: [], vowel: VOWELS[code], inherent: false, tail: '' })
      joining = false
    } else if (code === ANUSVARA || code === CHANDRABINDU || code === VISARGA) {
      const tail = code === VISARGA ? 'h' : 'N'
      if (current) current.tail = tail
      else units.push({ romans: [], codes: [], vowel: '', inherent: false, tail })
    }
    // Joiners and anything unassigned change nothing that is said.
  }

  const n = units.length
  const dropped: boolean[] = units.map(() => false)
  const sounded = (i: number) => units[i]!.vowel !== null || (units[i]!.inherent && !dropped[i])

  const last = units[n - 1]
  if (
    last &&
    n > 1 &&
    last.inherent &&
    last.tail === '' &&
    !(last.codes.length > 1 && KEEPS_FINAL_A.has(last.codes[last.codes.length - 1]!))
  ) {
    dropped[n - 1] = true
  }
  for (let i = n - 2; i >= 1; i--) {
    const unit = units[i]!
    if (
      unit.inherent &&
      unit.codes.length === 1 &&
      unit.tail === '' &&
      sounded(i - 1) &&
      sounded(i + 1) &&
      units[i + 1]!.codes.length <= 1
    ) {
      dropped[i] = true
      i-- // Never two in a row: `samajhna`, not `samjhna`.
    }
  }

  return units
    .map((unit, i) => {
      let vowel = unit.vowel ?? (unit.inherent && !dropped[i] ? 'a' : '')
      if (i === n - 1 && n > 1) {
        if (vowel === 'ee') vowel = 'i'
        else if (vowel === 'oo') vowel = 'u'
        else if (vowel === 'aa' && unit.tail === '') vowel = 'a'
      }
      const nextCode = units[i + 1]?.codes[0]
      const tail =
        unit.tail === 'N'
          ? nextCode !== undefined && LABIALS.has(nextCode)
            ? 'm'
            : 'n'
          : unit.tail
      return unit.romans.join('') + vowel + tail
    })
    .join('')
}

export function romanizeDevanagari(text: string): string {
  let out = ''
  let word: number[] = []
  const flush = () => {
    if (word.length > 0) out += romanizeWord(word)
    word = []
  }
  for (const ch of text) {
    const code = ch.charCodeAt(0)
    const inWord =
      (isDevanagari(ch) &&
        PUNCTUATION[code] === undefined &&
        !(code >= 0x0966 && code <= 0x096f)) ||
      ((code === ZWJ || code === ZWNJ) && word.length > 0)
    if (inWord) {
      word.push(code)
      continue
    }
    flush()
    if (code >= 0x0966 && code <= 0x096f) out += String(code - 0x0966)
    else out += PUNCTUATION[code] ?? ch
  }
  flush()
  return out
}
