import {
  CYRILLIC_LANGS,
  coversCyrillic,
  detectCyrillicLang,
  isCyrillic,
  romanizeCyrillic,
} from './cyrillic'
import { z } from 'zod'
import { MAX_MESSAGE_LENGTH } from '../chat'
import type { CyrillicLang } from './cyrillic'
import { isDevanagari, romanizeDevanagari } from './devanagari'
import { isGreek, romanizeGreek } from './greek'
import { isHangul, romanizeHangul } from './hangul'

export { CYRILLIC_LANGS, detectCyrillicLang, romanizeCyrillic, type CyrillicLang } from './cyrillic'
export { romanizeDevanagari } from './devanagari'
export { romanizeGreek } from './greek'
export { romanizeHangul } from './hangul'

/**
 * "How it reads": a message shown in Latin letters.
 *
 * Two engines. The alphabets and syllabaries whose spelling says how a word
 * is pronounced — Cyrillic, Greek, Hangul, Devanagari — are rules in this
 * directory: pure, dependency-free, linear in the text, and run on the device,
 * so a reading costs no request and no quota. Chinese and Japanese are not:
 * which reading a character takes depends on the word it is in, which needs a
 * dictionary and a segmenter, so those go to the voice service.
 *
 * Deliberately **neither**, and `romanizationFor` answers `null` for them:
 *
 * - **Arabic, Persian, Urdu, Hebrew** are written without most of their
 *   vowels. Letters alone give `ktb` for كتب, and which of *kataba*, *kutub*
 *   or *kutiba* it is depends on grammar and context — a guess, presented as
 *   how the word reads, would teach it wrong.
 * - **Thai** has no spaces between words and tone rules that depend on the
 *   syllable's class and length; doing it right needs a dictionary-backed
 *   segmenter, the heavy dependency this design exists to avoid.
 *
 * See `docs/decisions.md` → *Transliteration runs on rules we own*.
 */
export type RomanizationRulesLang = CyrillicLang | 'el' | 'ko' | 'hi'
export const ROMANIZATION_SERVICE_LANGS = ['zh', 'ja'] as const
export type RomanizationServiceLang = (typeof ROMANIZATION_SERVICE_LANGS)[number]

/**
 * The longest text the voice service romanizes, mirroring `MAX_ROMANIZE_TEXT`
 * in `apps/tts/server.py` (a test reads that file and checks). Every message
 * fits: a reading is dictionary lookups, not synthesis, so there is no reason
 * to cap it below what chat lets somebody send.
 */
export const ROMANIZE_MAX_TEXT_LENGTH = MAX_MESSAGE_LENGTH

/** What `POST …/romanize` answers. A cache hit is `cached: true`. */
export const messageRomanizationSchema = z.object({
  text: z.string(),
  lang: z.enum(ROMANIZATION_SERVICE_LANGS),
  cached: z.boolean(),
})
export type MessageRomanization = z.infer<typeof messageRomanizationSchema>

export type Romanization =
  | { engine: 'rules'; lang: RomanizationRulesLang; romanize: (text: string) => string }
  | { engine: 'service'; lang: RomanizationServiceLang }

type Script = 'cyrillic' | 'greek' | 'hangul' | 'devanagari' | 'cjk' | 'other'

function isKana(code: number): boolean {
  return (
    (code >= 0x3040 && code <= 0x30ff) ||
    (code >= 0x31f0 && code <= 0x31ff) ||
    (code >= 0xff66 && code <= 0xff9d)
  )
}

function isHan(code: number): boolean {
  return (
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0x20000 && code <= 0x3134f)
  )
}

/**
 * Scripts nobody here romanizes. Counted rather than ignored, so a message
 * mostly in Arabic with one Russian word in it is an Arabic message.
 */
const OTHER_SCRIPTS: readonly [number, number][] = [
  [0x0530, 0x058f], // Armenian
  [0x0590, 0x05ff], // Hebrew
  [0x0600, 0x06ff], // Arabic, Persian, Urdu
  [0x0700, 0x08ff], // Syriac, Thaana, Arabic supplements
  [0x0980, 0x0dff], // Bengali to Sinhala
  [0x0e00, 0x0fff], // Thai, Lao, Tibetan
  [0x1000, 0x109f], // Myanmar
  [0x10a0, 0x10ff], // Georgian
  [0x1200, 0x139f], // Ethiopic
  [0x1780, 0x17ff], // Khmer
  [0xfb1d, 0xfdff], // Hebrew and Arabic presentation forms
  [0xfe70, 0xfeff],
]

function scriptOf(ch: string): Script | null {
  if (isCyrillic(ch)) return 'cyrillic'
  if (isGreek(ch)) return 'greek'
  if (isHangul(ch)) return 'hangul'
  if (isDevanagari(ch)) return 'devanagari'
  const code = ch.codePointAt(0)!
  if (isKana(code) || isHan(code)) return 'cjk'
  if (OTHER_SCRIPTS.some(([from, to]) => code >= from && code <= to)) return 'other'
  return null
}

function hasKana(text: string): boolean {
  for (const ch of text) if (isKana(ch.codePointAt(0)!)) return true
  return false
}

/** Every rule script at once: each pass touches only its own letters. */
function rules(lang: RomanizationRulesLang, cyrillic: CyrillicLang | undefined): Romanization {
  return {
    engine: 'rules',
    lang,
    romanize: (text) => {
      const table = cyrillic ?? detectCyrillicLang(text)
      const latin = table ? romanizeCyrillic(text, table) : text
      return romanizeDevanagari(romanizeHangul(romanizeGreek(latin)))
    },
  }
}

/**
 * Which engine can show this text in Latin letters, or `null` for none.
 *
 * The text decides the script — the one with the most letters in it; Latin
 * letters are not counted, so a Russian sentence with an English word in it
 * is Russian. `langs` then picks between the languages that share a script,
 * first match winning: the message's known source language, then the
 * languages the two people have between them. Without one, the letters
 * decide (`ї` is Ukrainian, `ђ` Serbian; kana make Han Japanese).
 *
 * A Cyrillic text with letters none of the five tables has — Kazakh,
 * Mongolian — gets `null`, not a reading with holes in it.
 */
export function romanizationFor(
  text: string,
  langs: string | readonly (string | undefined)[] = [],
): Romanization | null {
  const counts: Partial<Record<Script, number>> = {}
  for (const ch of text) {
    const script = scriptOf(ch)
    if (script) counts[script] = (counts[script] ?? 0) + 1
  }
  let script: Script | null = null
  for (const [candidate, count] of Object.entries(counts) as [Script, number][]) {
    if (script === null || count > counts[script]!) script = candidate
  }
  if (script === null || script === 'other') return null

  const hints = (typeof langs === 'string' ? [langs] : langs).filter(
    (lang): lang is string => lang !== undefined,
  )
  switch (script) {
    case 'cyrillic': {
      const hinted = hints.find(
        (lang): lang is CyrillicLang =>
          (CYRILLIC_LANGS as readonly string[]).includes(lang) &&
          coversCyrillic(text, lang as CyrillicLang),
      )
      const lang = hinted ?? detectCyrillicLang(text)
      return lang ? rules(lang, lang) : null
    }
    case 'greek':
      return rules('el', undefined)
    case 'hangul':
      return rules('ko', undefined)
    case 'devanagari':
      return rules('hi', undefined)
    case 'cjk': {
      if (hasKana(text)) return { engine: 'service', lang: 'ja' }
      const hinted = hints.find((lang) => lang === 'ja' || lang === 'zh')
      return { engine: 'service', lang: hinted === 'ja' ? 'ja' : 'zh' }
    }
  }
}
