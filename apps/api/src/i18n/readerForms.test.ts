import type { Catalog } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { catalogs } from './catalogs'

/**
 * The reader of a Russian push or email is «ты», as in the app: the same
 * person reads both, and a push that said «Откройте LangX» under a token line
 * that said «твоё сообщение» was two voices from one sender. The patterns are
 * the app's, in apps/mobile/src/i18n/addressForm.test.ts and
 * apps/mobile/src/i18n/readerForms.test.ts.
 *
 * The plural stays where it means two people — the reader and a friend who
 * both get tokens («вам обоим», «получите оба»).
 *
 * Saying «ты» brings the reader's gender into every past tense: «вы
 * получили» needed none, «ты получил» guesses. So the second check is that
 * no line puts a past-tense verb or a short adjective beside the reader; those
 * lines say it another way («У тебя 2 новых значка», «Если это не ты»).
 */
const FORMAL = /(?<!\p{L})(?:вы|вас|вам|вами|ваш\p{L}*)(?!\p{L})/iu
const IMPERATIVE = /(?:^|[.,!?…:;—«(]\s*)\p{L}+(?:йте|ьте|ите)(?!\p{L})/iu
const BOTH = /(?<!\p{L})(?:оба|обоим|обоих)(?!\p{L})/iu

const PAST = String.raw`\p{L}+(?:л|ла|лся|лась|ёл|ог)(?:\(а\))?`
const SHORT = String.raw`(?:сам|сама|один из|одна из|уверен|уверена|готов|готова|рад|рада|должен|должна|согласен|согласна|первым|первой)`
const BETWEEN = String.raw`(?:\s+(?:—|уже|ещё|это|не|бы|тоже|только|раньше|им|его|её|их|сам|сама))*`
const GENDERED = [
  new RegExp(String.raw`(?<!\p{L})(?:ты|я)${BETWEEN}\s+(?:${PAST}|${SHORT})(?!\p{L})`, 'iu'),
  new RegExp(String.raw`(?<!\p{L})(?:что|как|где|когда)\s+${PAST}\s+(?:ты|я)(?!\p{L})`, 'iu'),
  new RegExp(String.raw`(?<!\p{L})(?!лишь)\p{L}+(?:ешь|ишь|ёшь)\s+${SHORT}(?!\p{L})`, 'iu'),
]

/**
 * Rewritten in this same batch with their numbers taken from config, and in
 * «ты» there: the sign-in link's lifetime and the feed digest's count.
 */
const REWRITTEN_ELSEWHERE: ReadonlySet<string> = new Set([
  'email.magicLinkBody',
  'email.existingLinkBody',
  'email.existingLinkText',
  'email.feedDigestSubject',
  'email.feedDigestBody',
])

function leaves(node: Catalog | string, prefix = ''): [string, string][] {
  if (typeof node === 'string') return [[prefix, node]]
  return Object.entries(node).flatMap(([key, value]) =>
    leaves(value as Catalog | string, prefix ? `${prefix}.${key}` : key),
  )
}

const entry = (path: string) => path.replace(/\.(?:zero|one|two|few|many|other)$/, '')
const formal = (text: string) => FORMAL.test(text) || IMPERATIVE.test(text)
const gendered = (text: string) => GENDERED.some((pattern) => pattern.test(text))

describe('the Russian server catalogue', () => {
  it('recognises the formal address and a gendered reader', () => {
    expect(
      ['Откройте LangX сегодня, чтобы её сохранить.', 'Если это были не вы:', 'Ваш пост'].filter(
        (text) => !formal(text),
      ),
    ).toEqual([])
    expect(
      ['Открой LangX сегодня, чтобы её сохранить.', 'Ссылка на сайте', 'Привет!'].filter(formal),
    ).toEqual([])
    expect(
      ['Мы прочитали то, что ты прислал', 'Ты получил 2 новых значка', 'Ты был здесь'].filter(
        (text) => !gendered(text),
      ),
    ).toEqual([])
    expect(
      ['Мы прочитали твоё сообщение', 'У тебя 2 новых значка', 'Если это не ты'].filter(gendered),
    ).toEqual([])
  })

  it('addresses one reader as «ты»', () => {
    const found = leaves(catalogs.ru)
      .filter(([path]) => !REWRITTEN_ELSEWHERE.has(entry(path)))
      .filter(([, text]) => formal(text) && !BOTH.test(text))
      .map(([path, text]) => `${path}: ${text}`)
    expect(found).toEqual([])
  })

  it('never guesses the reader’s gender', () => {
    const found = leaves(catalogs.ru)
      .filter(([, text]) => gendered(text))
      .map(([path, text]) => `${path}: ${text}`)
    expect(found).toEqual([])
  })
})
