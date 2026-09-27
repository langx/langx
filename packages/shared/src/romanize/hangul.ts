/**
 * Korean in Latin letters — the Revised Romanization (Ministry of Culture,
 * 2000), the one on every road sign in South Korea.
 *
 * A syllable block is arithmetic: `code - 0xAC00` is `(initial × 21 + vowel)
 * × 28 + final`. RR writes what is *said*, not what is spelled, so the sound
 * changes between two blocks of one word are applied here:
 *
 * - **Linking**: a final before a silent `ㅇ` moves across (`한국어`
 *   `hangugeo`); of a double final only the second moves (`없어` `eopseo`), and
 *   a final `ㅎ` there disappears (`좋아` `joa`).
 * - **Palatalisation**: `ㄷ ㅌ` before `이` are `j ch` (`같이` `gachi`).
 * - **Nasalisation**: a `k t p` sound before `ㄴ ㅁ` is `ng n m`
 *   (`합니다` `hamnida`, `국물` `gungmul`).
 * - **ㄹ**: `ㄴㄹ` and `ㄹㄴ` are `ll` (`신라` `silla`, `설날` `seollal`); after
 *   `ㅁ ㅇ k p` an `ㄹ` is `n` (`종로` `jongno`, `협력` `hyeomnyeok`).
 * - **Aspiration after ㅎ**: `ㅎ` before `ㄱ ㄷ ㅈ` makes them `k t ch`
 *   (`좋다` `jota`), before `ㅅ` makes it `ss`, and before `ㄴ` is `n`.
 *
 * Not handled, on purpose or because only a dictionary knows: tensing (RR does
 * not write it anyway); aspiration of `ㄱ ㄷ ㅂ` before `ㅎ`, which RR skips in
 * nouns and a rule cannot tell nouns apart (`축하` stays `chukha`, which happens
 * to be right); the inserted `ㄴ` of compounds (`색연필` is `saegyeonpil` here,
 * `saengnyeonpil` aloud); and RR's optional hyphens. Nothing crosses a space,
 * and a block is never capitalised — Hangul has no case to carry over.
 */
const INITIALS = [
  'g',
  'kk',
  'n',
  'd',
  'tt',
  'r',
  'm',
  'b',
  'pp',
  's',
  'ss',
  '',
  'j',
  'jj',
  'ch',
  'k',
  't',
  'p',
  'h',
]
const VOWELS = [
  'a',
  'ae',
  'ya',
  'yae',
  'eo',
  'e',
  'yeo',
  'ye',
  'o',
  'wa',
  'wae',
  'oe',
  'yo',
  'u',
  'wo',
  'we',
  'wi',
  'yu',
  'eu',
  'ui',
  'i',
]

// Initial indices the rules below name.
const G = 0
const N = 2
const D = 3
const R = 5
const M = 6
const S = 9
const SS = 10
const SILENT = 11
const J = 12
const CH = 14
const K = 15
const T = 16
const VOWEL_I = 20

type Coda = '' | 'k' | 'n' | 't' | 'l' | 'm' | 'p' | 'ng'

/** What each of the 28 finals sounds like at the end of a syllable. */
const CODA: Coda[] = [
  '',
  'k',
  'k',
  'k',
  'n',
  'n',
  'n',
  't',
  'l',
  'k',
  'm',
  'l',
  'l',
  'l',
  'p',
  'l',
  'm',
  'p',
  'p',
  't',
  't',
  'ng',
  't',
  't',
  'k',
  't',
  'p',
  't',
]

/**
 * Before a silent `ㅇ`: which final stays behind and which initial moves
 * across. `null` for `ㅇ`, which never moves.
 */
const LINK: ([number, number] | null)[] = [
  [0, SILENT],
  [0, G],
  [0, 1],
  [1, S],
  [0, N],
  [4, J],
  [0, N],
  [0, D],
  [0, R],
  [8, G],
  [8, M],
  [8, 7],
  [8, S],
  [8, T],
  [8, 17],
  [0, R],
  [0, M],
  [0, 7],
  [17, S],
  [0, S],
  [0, SS],
  null,
  [0, J],
  [0, CH],
  [0, K],
  [0, T],
  [0, 17],
  [0, SILENT],
]

/** Finals that end in `ㅎ`: `ㄶ`, `ㅀ` and `ㅎ` itself. */
const H_FINAL: Record<number, number> = { 6: 4, 15: 8, 27: 0 }

/** Letter jamo typed on their own — `ㅋㅋ`, `ㅠㅠ`. */
const COMPAT: Record<number, string> = {
  0x3131: 'g',
  0x3132: 'kk',
  0x3134: 'n',
  0x3137: 'd',
  0x3138: 'tt',
  0x3139: 'r',
  0x3141: 'm',
  0x3142: 'b',
  0x3143: 'pp',
  0x3145: 's',
  0x3146: 'ss',
  0x3147: 'ng',
  0x3148: 'j',
  0x3149: 'jj',
  0x314a: 'ch',
  0x314b: 'k',
  0x314c: 't',
  0x314d: 'p',
  0x314e: 'h',
}
VOWELS.forEach((vowel, index) => {
  COMPAT[0x314f + index] = vowel
})

export function isHangul(ch: string): boolean {
  const code = ch.charCodeAt(0)
  return (code >= 0xac00 && code <= 0xd7a3) || (code >= 0x3131 && code <= 0x318e)
}

interface Syllable {
  initial: number
  vowel: number
  final: number
}

function decompose(ch: string): Syllable | null {
  const code = ch.charCodeAt(0) - 0xac00
  if (code < 0 || code > 11171) return null
  return { initial: Math.floor(code / 588), vowel: Math.floor((code % 588) / 28), final: code % 28 }
}

/**
 * Romanizes one run of consecutive blocks: the boundary rules look one block
 * ahead, and may rewrite that block's initial before it is written.
 */
function romanizeWord(word: Syllable[]): string {
  let out = ''
  for (let i = 0; i < word.length; i++) {
    const s = word[i]!
    const next = word[i + 1]
    let coda: string = CODA[s.final]!
    if (next && s.final !== 0) {
      const link = LINK[s.final]
      if (next.initial === SILENT && link) {
        const [stays, moves] = link
        coda = CODA[stays]!
        // `굳이` is `guji`, `같이` `gachi`, `핥이` `halchi`.
        const palatal = next.vowel === VOWEL_I && (moves === D || moves === T)
        next.initial = palatal ? (moves === D ? J : CH) : moves
      } else if (H_FINAL[s.final] !== undefined && [G, D, J, S, N].includes(next.initial)) {
        coda = CODA[H_FINAL[s.final]!]!
        if (next.initial === N) {
          if (s.final === 27) coda = 'n'
          else if (coda === 'l') next.initial = R
        } else {
          next.initial =
            next.initial === G ? K : next.initial === D ? T : next.initial === J ? CH : SS
        }
      } else if (next.initial === N || next.initial === M) {
        if (coda === 'k') coda = 'ng'
        else if (coda === 't') coda = 'n'
        else if (coda === 'p') coda = 'm'
        else if (coda === 'l' && next.initial === N) next.initial = R
      } else if (next.initial === R) {
        if (coda === 'n') coda = 'l'
        else if (coda === 'k') {
          coda = 'ng'
          next.initial = N
        } else if (coda === 'p') {
          coda = 'm'
          next.initial = N
        } else if (coda === 't') {
          coda = 'n'
          next.initial = N
        } else if (coda === 'm' || coda === 'ng') next.initial = N
      }
    }
    // An `ㄹ` after an `ㄹ` is the second `l` of `ll`, not an `r`.
    // Only a written coda leaves `out` ending in `l`; no vowel does.
    const initial = s.initial === R && out.endsWith('l') ? 'l' : INITIALS[s.initial]!
    out += initial + VOWELS[s.vowel]! + coda
  }
  return out
}

export function romanizeHangul(text: string): string {
  const chars = [...text]
  let out = ''
  let word: Syllable[] = []
  const flush = () => {
    if (word.length > 0) out += romanizeWord(word)
    word = []
  }
  for (const ch of chars) {
    const syllable = decompose(ch)
    if (syllable) {
      word.push(syllable)
      continue
    }
    flush()
    const compat = COMPAT[ch.charCodeAt(0)]
    out += compat ?? ch
  }
  flush()
  return out
}
