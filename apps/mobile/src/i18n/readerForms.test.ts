import type { Catalog } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { catalogs } from './catalogs'
import { NATIVE_KEYS } from './nativeKeys'

/**
 * Russian puts the speaker's gender into the past tense: «ты отметил» is said
 * to a man, «ты отметила» to a woman, and «ты отметил(а)» to a form. The app
 * does not know who is reading — most profiles never say — so a line
 * addressed to the reader, or written in the reader's own voice, says it
 * without one: the present («что пишешь ты»), a noun («исправление для
 * {name}») or a participle («отмеченные тобой»).
 *
 * What this can see is the gender next to the word for the reader: «ты» or
 * «я» with a past-tense verb or a short adjective («ты уже использовал»,
 * «Я прочитал(а)», «Ты — один из», «пока ты сам не решишь»), and a verb in
 * the second person with one («Отвечаешь сам себе», «Когда будешь готов»).
 * A sentence with no such word — «Забыл?», «Скажи первым» — carries the
 * gender in the verb alone, and no pattern tells «Скажи первым» from
 * «исправление может стать первым»; those were found by reading.
 *
 * The server's catalogue is held to the same in
 * apps/api/src/i18n/readerForms.test.ts.
 */
const PAST = String.raw`\p{L}+(?:л|ла|лся|лась|ёл|ог)(?:\(а\))?`
const SHORT = String.raw`(?:сам|сама|один из|одна из|уверен|уверена|готов|готова|рад|рада|должен|должна|согласен|согласна|первым|первой)`
const BETWEEN = String.raw`(?:\s+(?:—|уже|ещё|это|не|бы|тоже|только|раньше|им|его|её|их|сам|сама))*`
const GENDERED = [
  new RegExp(String.raw`(?<!\p{L})(?:ты|я)${BETWEEN}\s+(?:${PAST}|${SHORT})(?!\p{L})`, 'iu'),
  // «что написал ты»: the verb first. Only after a conjunction, because a
  // noun can end in «-л» too — «фильм или сериал ты мне посоветуешь».
  new RegExp(String.raw`(?<!\p{L})(?:что|как|где|когда)\s+${PAST}\s+(?:ты|я)(?!\p{L})`, 'iu'),
  // The second person with no pronoun. «лишь» only looks like one.
  new RegExp(String.raw`(?<!\p{L})(?!лишь)\p{L}+(?:ешь|ишь|ёшь)\s+${SHORT}(?!\p{L})`, 'iu'),
]

/**
 * Sample sentences in someone else's voice — the partner's message under a
 * sticker, the text the translation setting shows translated, the correction
 * the intro demonstrates. Their gender belongs to whoever is speaking.
 */
const SAMPLES: ReadonlySet<string> = new Set([
  'intro.correctionBefore',
  'intro.correctionAfter',
  'settings.translateExample',
  'stickerPack.chatTheirs',
])

/**
 * The keys in `NATIVE_KEYS` wait for a native build — see addressForm.test.ts.
 * `chat.speakLimit` is rewritten in this same batch to take its reset window
 * from config, in words that need no gender.
 */
const SKIP: ReadonlySet<string> = new Set([...NATIVE_KEYS, ...SAMPLES, 'chat.speakLimit'])

const OLD = [
  'Звезда наверху открывает все сообщения, которые ты отметил, из всех чатов.',
  'ты исправил(а) {name}',
  'Я прочитал(а) и принимаю',
  'Ты — один из участников',
  'Увидит ли собеседник, что я им пользовался?',
  'Что о тебе пишут собеседники и что написал ты',
  'Отвечаешь сам себе',
  'Когда будешь готов',
]
const NEUTRAL = [
  'Звезда наверху открывает все отмеченные тобой сообщения из всех чатов.',
  'исправление для {name}',
  'Ты среди участников',
  'Что о тебе пишут собеседники и что пишешь ты',
  'Какой фильм или сериал ты мне посоветуешь?',
  'Твоё исправление может стать первым.',
  'Если бы у тебя могла быть одна суперспособность, какая бы это была?',
]

function leaves(node: Catalog | string, prefix = ''): [string, string][] {
  if (typeof node === 'string') return [[prefix, node]]
  return Object.entries(node).flatMap(([key, value]) =>
    leaves(value as Catalog | string, prefix ? `${prefix}.${key}` : key),
  )
}

const gendered = (text: string) => GENDERED.some((pattern) => pattern.test(text))
const skipped = (path: string) =>
  SKIP.has(path) || SKIP.has(path.replace(/\.(?:zero|one|two|few|many|other)$/, ''))

describe('the Russian catalogue', () => {
  it('recognises a gendered reader and lets a neutral one pass', () => {
    expect(OLD.filter((text) => !gendered(text))).toEqual([])
    expect(NEUTRAL.filter(gendered)).toEqual([])
  })

  it('never guesses the reader’s gender', () => {
    const found = leaves(catalogs.ru)
      .filter(([path, text]) => !skipped(path) && gendered(text))
      .map(([path, text]) => `${path}: ${text}`)
    expect(found).toEqual([])
  })
})
