/**
 * Picks the phrases a pack is made of, and the glosses that already exist for
 * them.
 *
 * A pack is phrases, not words. A card in Echo is normally a sentence somebody
 * said to you, and a pack card that is a bare word is a different thing wearing
 * the same shape — so the packs are set expressions and short sentence
 * patterns, at every level.
 *
 * Two sources, because they answer different halves of the question:
 *
 * - **Wiktionary's phrasebook category** (`Category:<Language> phrasebook`) is
 *   everyday expressions — _excuse me_, _be careful_, _can I come in_ — each a
 *   dictionary entry with translations somebody curated. `build-pack.mjs`
 *   glosses these the same way it glosses a word. English has 460 of them and
 *   no other language comes close: Russian 170, German 104, French 93, Spanish
 *   79, Italian 57. Outside English a pack is mostly the other source. The category listing is an
 *   input rather than something this fetches: Wikimedia rate-limits the API
 *   hard from a shared address, and a run that fails on the fourth 429 after
 *   twenty minutes of streaming Tatoeba is a run nobody repeats.
 * - **Tatoeba** is short sentences with human translations into the eight
 *   locales. No dictionary has an entry for "Why do you ask?", and no machine
 *   should be inventing one, so the translation comes from the person who
 *   wrote it. Those glosses are written out here and handed to `build-pack.mjs`.
 *
 * **Level is the level of the hardest word in the phrase**, looked up in a
 * CEFR profile — or, for every language but English, in a frequency list,
 * because no CEFR list for them is licensed for commercial use. See
 * `frequencyBands`. Either way it is mapped onto our four by the same table
 * `packages/shared/src/level.ts` uses. A phrase every one of whose words is A1
 * is an `absoluteBeginner` phrase. A word no profile lists counts as above the
 * band rather than below it, which is what keeps _beware of the dog_ and _bon
 * voyage_ out of a first pack.
 *
 * `--profile` is repeatable and read in order, first band wins: CEFR-J covers
 * A1–B2 and the Octanove profile covers C1–C2, and between them every level has
 * a ceiling. Without the second one `fluent` has no words of its own and comes
 * out empty rather than wrong.
 *
 * **Every level in one pass.** The Tatoeba exports are two hundred megabytes;
 * streaming them once per level to ask the same question with a different
 * filter is four times the download for the same answer.
 *
 * Usage — the category listing first, saved exactly as the API returns it
 * (`Category:Spanish phrasebook` for a Spanish pack, and so on):
 *
 *   curl -s 'https://en.wiktionary.org/w/api.php?action=query&list=categorymembers&cmtitle=Category:English%20phrasebook&cmlimit=500&cmnamespace=0&format=json&formatversion=2' -o ./phrasebook.json
 *
 *   node tools/echo-content/pick-phrases.mjs \
 *     --profile ./cefrj-vocabulary-profile-1.5.csv \
 *     --profile ./octanove-vocabulary-profile-c1c2-1.0.csv \
 *     --ngsl ./NGSL_12_lemmatized_for_teaching.csv --ngsl-stats ./NGSL_12_stats.csv \
 *     --phrasebook ./phrasebook.json --limit 300 --out-dir ./picked
 *
 * and for any other language, where the profiles do not exist:
 *
 *   node tools/echo-content/pick-phrases.mjs --lang es \
 *     --frequency ./es_50k.txt \
 *     --phrasebook ./es-phrasebook.json --limit 300 --out-dir ./picked-es
 *
 * `--require` is the locales a sentence must be glossed into to be taken at
 * all; it defaults to all seven for English and to `en` for everything else,
 * which is the measurement in `tatoeba` below. Sentences with more than the
 * floor are preferred over sentences with the floor.
 *
 * Writes `<level>.txt` and `<level>.glosses.json` per level into `--out-dir`,
 * for every level unless `--levels` names some. Leave `--phrasebook` off and the
 * packs are Tatoeba sentences only.
 *
 * Needs `bzip2` on the path: Tatoeba publishes bz2 and node has no decoder for
 * it. Everything is streamed, so the exports are never written to disk.
 * `--tatoeba` points at a copy of `per_language/` instead — a directory or a
 * `file://` URL — for a run that will be repeated: the
 * `fluent` measurement read every export a dozen times.
 *
 * `--cues ./images/cues.es.json` takes only phrases that table gives a picture
 * to. Run once without it and a large `--limit` to get a pool, write the cues
 * for the pool, then run again with it at the pack's size. See `cued`. The
 * Arabic and Turkish packs were picked that way:
 *
 *   node tools/echo-content/pick-phrases.mjs --lang ar --frequency ./ar_50k.txt \
 *     --tatoeba ./tatoeba/per_language --levels absoluteBeginner,beginner,intermediate \
 *     --cues tools/echo-content/images/cues.ar.json --limit 300 --out-dir ./picked-ar
 */

import { spawn } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { opening, spread } from './order.mjs'
import { writable } from './text.mjs'

/** Interface locale → the Tatoeba language directory that holds it. */
const LOCALE_EXPORTS = {
  en: 'eng',
  tr: 'tur',
  de: 'deu',
  es: 'spa',
  fr: 'fra',
  'pt-BR': 'por',
  ru: 'rus',
  ar: 'ara',
}

/** A pack language → its Tatoeba directory, for the languages packs exist in. */
const PACK_EXPORTS = { ...LOCALE_EXPORTS, pt: 'por', it: 'ita' }

/**
 * The columns a pack in `lang` is glossed into — the eight interface locales
 * less its own, which is the side of the card the learner is reading.
 */
function localesFor(lang) {
  return Object.fromEntries(
    Object.entries(LOCALE_EXPORTS).filter(([locale]) => locale.split('-')[0] !== lang),
  )
}

/** CEFR band → our four levels. The copy of `CEFR_TO_LANGUAGE_LEVEL` a plain
 * `.mjs` tool cannot import; it is six lines and it must not drift. */
const LEVELS = {
  A1: 'absoluteBeginner',
  A2: 'beginner',
  B1: 'intermediate',
  B2: 'intermediate',
  C1: 'fluent',
  C2: 'fluent',
}

/**
 * A sentence has to be a sentence: long enough to carry a pattern, short
 * enough to read on a card and to type back when a production card asks for
 * it (`ECHO_PRODUCTION_MAX_LENGTH`, 40 characters).
 *
 * **Two words is a sentence in Turkish and Arabic.** Both glue the pronoun,
 * the object and the negation onto the verb: _Seni seviyorum._ is "I love
 * you." and _قرأت كتابك._ is "I read your book.", three and four words in
 * English. A floor of three, measured in a language that writes those apart,
 * drops exactly the short, everyday sentences a first pack is made of.
 */
const MIN_WORDS = 3
const MIN_WORDS_BY_LANG = { tr: 2, ar: 2 }
const MAX_WORDS = 8

/**
 * Where a sentence may end. Arabic asks with its own mark, `؟` (U+061F), and
 * a filter that only knew `?` refused every Arabic question in the export.
 */
const SENTENCE_ENDS = '.?!؟'

/** `don't` is one token to a regular expression and two words to CEFR-J. */
const CONTRACTIONS = {
  "don't": ['do', 'not'],
  "doesn't": ['does', 'not'],
  "didn't": ['did', 'not'],
  "isn't": ['is', 'not'],
  "aren't": ['are', 'not'],
  "wasn't": ['was', 'not'],
  "can't": ['can', 'not'],
  "won't": ['will', 'not'],
  "couldn't": ['could', 'not'],
  "wouldn't": ['would', 'not'],
  "shouldn't": ['should', 'not'],
  "i'm": ['i', 'am'],
  "i've": ['i', 'have'],
  "i'll": ['i', 'will'],
  "i'd": ['i', 'would'],
  "you're": ['you', 'are'],
  "you've": ['you', 'have'],
  "we're": ['we', 'are'],
  "they're": ['they', 'are'],
  "it's": ['it', 'is'],
  "that's": ['that', 'is'],
  "there's": ['there', 'is'],
  "what's": ['what', 'is'],
  "let's": ['let', 'us'],
  "here's": ['here', 'is'],
}

const UA = 'langx-echo-content/2.0 (https://langx.io; hi@langx.io)'

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index < 0 ? fallback : process.argv[index + 1]
}

/** Every `--name value` pair, for the flags that may be given more than once. */
function args(name) {
  const found = []
  for (const [index, value] of process.argv.entries()) {
    if (value === `--${name}` && process.argv[index + 1]) found.push(process.argv[index + 1])
  }
  return found
}

/**
 * A bz2 export, decompressed and handed over a line at a time.
 *
 * No shell: the URL comes from `--tatoeba`, and a quote in it would otherwise
 * be a command. curl and bzip2 are spawned with argument lists and joined by a
 * pipe here, and a local mirror is read by node rather than by curl.
 */
async function* lines(url) {
  const bzip2 = spawn('bzip2', ['-dc'])
  bzip2.stderr.pipe(process.stderr)
  if (/^https?:/.test(url)) {
    const curl = spawn('curl', ['-sS', '--max-time', '900', '-A', UA, url])
    curl.stderr.pipe(process.stderr)
    curl.stdout.pipe(bzip2.stdin)
  } else {
    createReadStream(url.startsWith('file:') ? fileURLToPath(url) : url).pipe(bzip2.stdin)
  }
  for await (const line of createInterface({ input: bzip2.stdout, crlfDelay: Infinity })) yield line
}

/**
 * The same map as `gradedWords`, banded by frequency instead of by a profile.
 *
 * There is no CEFR list for the languages after English. CEFR-J is English
 * only, and CEFRLex — the one resource that bands French, Spanish and German —
 * is CC BY-NC-SA, which an app that sells subscriptions cannot ship a
 * derivative of. What is left that is both free and commercial is frequency:
 * hermitdave/FrequencyWords, one `<lang>_50k.txt` per language from the
 * OpenSubtitles 2018 corpus, CC BY-SA 4.0 for the content.
 *
 * The bands are the thresholds, and they are a judgement rather than a
 * measurement — the first thousand forms of a subtitle corpus are roughly what
 * a first week teaches. A form past the last band is unlisted, exactly as an
 * unlisted word is to CEFR-J, and its phrase is dropped rather than guessed at.
 *
 * **Surface forms, not lemmas**, which matters most in Russian and German: a
 * declined form that did not make the top ten thousand bands its phrase out
 * even where the lemma is everyday. That is the conservative direction, and
 * review pulls back what it should not have lost.
 *
 * **C1 and C2 are the rest of the list**, added for `fluent` the way the
 * Octanove profile was added for English: without a band above B1 a phrase
 * whose hardest word is rank 10,001 is unlisted, and `fluent` came out empty
 * rather than wrong. The ceiling is the file's own — fifty thousand forms —
 * because past it a subtitle corpus is mostly names, typos and transcribed
 * noise, which is exactly what "unlisted, so dropped" should still catch. The
 * split at 25,000 decides nothing (both are `fluent`); it is there so the
 * table reads as CEFR does. The bands below B1 are untouched, so no phrase
 * moves between the three packs that already exist.
 *
 * The surface-form caveat cuts the other way up here: a declined form of an
 * everyday Russian or German word can rank past ten thousand and make its
 * phrase `fluent` for its ending rather than its vocabulary. Review is where
 * that is caught; see `FLUENT-MEASUREMENT.md`.
 */
const FREQUENCY_BANDS = [
  [1000, 'A1'],
  [3000, 'A2'],
  [10000, 'B1'],
  [25000, 'C1'],
  [50000, 'C2'],
]

async function frequencyBands(path) {
  const level = new Map()
  let rank = 0
  for (const line of (await readFile(path, 'utf8')).split('\n')) {
    const word = line.split(' ')[0]?.trim().toLowerCase()
    if (!word) continue
    rank += 1
    const band = FREQUENCY_BANDS.find(([ceiling]) => rank <= ceiling)?.[1]
    if (!band) break
    if (!level.has(word)) level.set(word, band)
  }
  return level
}

/** The same ordering key as `frequencyRanks`, from the same file. */
async function frequencyRanksFrom(path) {
  const rank = new Map()
  let index = 0
  for (const line of (await readFile(path, 'utf8')).split('\n')) {
    const word = line.split(' ')[0]?.trim().toLowerCase()
    if (!word) continue
    index += 1
    if (!rank.has(word)) rank.set(word, index)
  }
  return rank
}

/** Naive CSV: the two files this reads quote nothing in the columns it uses. */
function rows(text) {
  const [header, ...rest] = text.trim().split('\n')
  const names = header.split(',').map((name) => name.replace(/^\uFEFF/, '').trim())
  return rest.map((line) => {
    const cells = line.split(',')
    return Object.fromEntries(names.map((name, index) => [name, (cells[index] ?? '').trim()]))
  })
}

/**
 * Every word form we know a CEFR band for.
 *
 * CEFR-J levels headwords; NGSL lists the inflections of the same headword, and
 * a sentence is written in inflections. Without the second file `Are you sure?`
 * passes and `Where are the books?` does not, for no reason a learner could see.
 */
async function gradedWords(profilePaths, ngslPath) {
  const level = new Map()
  // In order: the first profile to band a word wins, so CEFR-J's A1 is not
  // overwritten by a C1 homograph from the profile that covers the top.
  for (const path of profilePaths) {
    for (const row of rows(await readFile(path, 'utf8'))) {
      for (const variant of (row.headword ?? '').split('/')) {
        const word = variant.trim().toLowerCase()
        if (word && !level.has(word)) level.set(word, row.CEFR)
      }
    }
  }
  for (const line of (await readFile(ngslPath, 'utf8')).split('\n')) {
    if (line.startsWith('##') || !line.trim()) continue
    const forms = line
      .trim()
      .split(',')
      .map((form) => form.trim().toLowerCase())
    const band = level.get(forms[0])
    if (!band) continue
    for (const form of forms.slice(1)) if (form && !level.has(form)) level.set(form, band)
  }
  return level
}

/**
 * A phrase as the frequency list spells it, for looking its words up.
 *
 * **Turkish lowercases by its own rule.** `I` is `ı` and `İ` is `i`; the
 * locale-blind `toLowerCase` turns `Işık` into `işık` and `İyi` into `i` plus a
 * combining dot, which `\p{L}` then splits off — two ways for an everyday word
 * to go missing from the list and take its sentence with it.
 *
 * **Arabic is looked up without its vowel marks.** Tatoeba writes harakat on
 * some sentences and not on others, and the subtitle corpus behind the
 * frequency list almost never does. A mark is `\p{M}`, not `\p{L}`, so left in
 * it would also cut `مَرْحَبًا` into single letters. The tatweel, a stretch
 * with no sound, goes for the same reason. Only the lookup is bare: the text
 * that reaches the card keeps every mark its writer put there.
 */
function lower(phrase, lang) {
  if (lang === 'tr') return phrase.toLocaleLowerCase('tr')
  if (lang === 'ar') return phrase.normalize('NFC').replace(/[\p{M}ـ]/gu, '')
  return phrase.toLowerCase()
}

/**
 * The words of a phrase, in any script.
 *
 * `\p{L}` rather than `a-z`: `días` is one Spanish word and two ASCII ones,
 * and a Russian sentence matches nothing at all — which would have banded
 * every Cyrillic phrase as unlisted and dropped the whole language quietly.
 * Contractions are English and only English; French elision (`j'ai`) is one
 * word to a frequency list too.
 */
function words(phrase, lang = 'en') {
  return (
    lower(phrase, lang)
      .match(/[\p{L}']+/gu)
      ?.flatMap((token) =>
        lang === 'en' ? (CONTRACTIONS[token] ?? [token.replace(/^'|'$/g, '')]) : [token],
      )
      .filter(Boolean) ?? []
  )
}

/**
 * The level of a phrase, or null when a word is not in the profile at all.
 *
 * Null rather than a guess: an unlisted word is usually rarer than everything
 * CEFR-J bothered to band, and dropping the phrase is cheaper than teaching
 * _mercies_ to somebody on their first day.
 */
function levelOf(phrase, graded, lang) {
  const bands = []
  for (const word of words(phrase, lang)) {
    const band = graded.get(word)
    if (!band) return null
    bands.push(band)
  }
  if (bands.length === 0) return null
  const order = Object.keys(LEVELS)
  const hardest = bands.reduce((a, b) => (order.indexOf(a) >= order.indexOf(b) ? a : b))
  return LEVELS[hardest] ?? null
}

/**
 * Whether the word that makes a phrase this hard is a name.
 *
 * Only asked at `fluent`, where it decides most of the pool otherwise. Below
 * B1 a name is either common enough to be in the band (_Tom_) or unlisted and
 * dropped. Above it, every place and person in the top fifty thousand forms is
 * suddenly "C1": the first `fluent` pool was _Vivo en Atenas._, _Soy Susan
 * Greene._ and _Chipre es una isla._ — A1 sentences carrying a rare name. A
 * phrase is fluent for its vocabulary, so one that rests on a capitalised word
 * is not taken.
 *
 * Not German, where every noun is capitalised and this would read every
 * common noun as a name. A German `fluent` pool keeps its names for review to
 * catch, and the Russian one is held to the rule like the rest.
 */
function restsOnName(text, graded, lang) {
  if (lang === 'de') return false
  const order = Object.keys(LEVELS)
  const tokens = text.match(/[\p{L}']+/gu) ?? []
  const ranks = tokens.map((token) => order.indexOf(graded.get(token.toLowerCase())))
  const hardest = Math.max(...ranks)
  return tokens.some((token, index) => ranks[index] === hardest && /^\p{Lu}/u.test(token))
}

/**
 * A phrase is more than one word.
 *
 * The phrasebook category carries `hello`, `yes` and `sorry`, which are
 * expressions in the sense that matters to a phrasebook and single words in the
 * sense that matters here. A pack that opens with six of them is the dictionary
 * this module exists not to be, and a learner meets `hello` in the first
 * sentence that greets them anyway.
 */
function isPhrase(text) {
  return /\s/.test(text.trim())
}

/** Near-duplicates: Tatoeba holds `I love you.` and `I love you!` separately. */
function shape(phrase) {
  return phrase
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * The category listing, exactly as the API returned it.
 *
 * An input rather than a request this makes, and that is a correction: the
 * first version fetched it and needed a retry loop, because Wikimedia
 * rate-limits the API hard from a shared address and answered 429 four times
 * running. A twenty-minute Tatoeba stream that then dies on a category listing
 * is a run nobody repeats, and every other input here — the CEFR-J profile, the
 * NGSL lists — is already a file somebody downloaded once.
 */
async function phrasebook(path) {
  if (!path) return []
  const body = JSON.parse(await readFile(path, 'utf8'))
  return (body.query?.categorymembers ?? []).map((member) => member.title)
}

/**
 * The phrases a cue table gives a picture to, when `--cues` names one.
 *
 * A pack where every card carries a cue is a rule decided before the phrases
 * are, so it belongs here rather than in a pass that deletes items afterwards:
 * the picker then takes the next-best candidate in place of an uncued one and
 * the pack keeps its size. The table is `images/cues.<lang>.json`, written by
 * a person against a larger pool first — a phrase whose only picture would be
 * a literal drawing of its idiom has no honest cue and is simply not in it.
 */
async function cued(path) {
  if (!path) return null
  return new Set(Object.keys(JSON.parse(await readFile(path, 'utf8'))))
}

/**
 * Tatoeba sentences at the wanted level, with the translations they have.
 *
 * **`required` is why this is a parameter and not a constant.** English asks
 * for all seven other locales, and can: Tatoeba links 16,322 English sentences
 * to Arabic. Nothing else comes close — Spanish 3,393, French 3,104, German
 * 2,971, Italian 735 — so the same rule outside English does not make a
 * stricter pack, it makes no pack. Every other language requires English only,
 * which is the floor `glossFor` falls back to, and carries the rest where a
 * contributor wrote one. The caller then prefers the best-covered sentences,
 * so the thin columns still fill as far as the data allows.
 */
async function tatoeba(graded, levels, lang, locales, required, base) {
  const source = PACK_EXPORTS[lang]
  const sentences = new Map()
  const levelOfId = new Map()
  for await (const line of lines(`${base}/${source}/${source}_sentences.tsv.bz2`)) {
    const [id, , text] = line.split('\t')
    if (!text || !SENTENCE_ENDS.includes(text.at(-1))) continue
    const count = words(text, lang).length
    if (count < (MIN_WORDS_BY_LANG[lang] ?? MIN_WORDS) || count > MAX_WORDS) continue
    const band = levelOf(text, graded, lang)
    if (!band || !levels.includes(band)) continue
    if (band === 'fluent' && restsOnName(text, graded, lang)) continue
    sentences.set(id, text)
    levelOfId.set(id, band)
  }
  // One pass for every level asked for. Four passes would stream two hundred
  // megabytes four times to answer the same question with a different filter.
  console.error(`  tatoeba: ${sentences.size} ${lang} sentences across ${levels.join(', ')}`)

  const glosses = new Map()
  for (const [locale, code] of Object.entries(locales)) {
    const wanted = new Map()
    for await (const line of lines(`${base}/${source}/${source}-${code}_links.tsv.bz2`)) {
      const [from, to] = line.split('\t')
      if (sentences.has(from) && to && !wanted.has(to)) wanted.set(to.trim(), from)
    }
    let found = 0
    for await (const line of lines(`${base}/${code}/${code}_sentences.tsv.bz2`)) {
      const [id, , text] = line.split('\t')
      const sourceId = wanted.get(id)
      if (!sourceId || !text?.trim()) continue
      const gloss = glosses.get(sourceId) ?? {}
      if (gloss[locale]) continue
      gloss[locale] = text.trim()
      glosses.set(sourceId, gloss)
      found += 1
    }
    console.error(`  tatoeba: ${locale} covers ${found}`)
  }

  const complete = new Map(levels.map((band) => [band, []]))
  for (const [id, raw] of glosses) {
    // An unusable column is dropped rather than taking the sentence with it:
    // a bad Russian gloss is one blank back for Russian readers, where under
    // the old rule it cost every other reader the card as well.
    const gloss = Object.fromEntries(Object.entries(raw).filter(([, text]) => writable(text)))
    if (!required.every((locale) => gloss[locale])) continue
    const text = sentences.get(id)
    if (!writable(text)) continue
    complete.get(levelOfId.get(id))?.push({ text, gloss, covers: Object.keys(gloss).length })
  }
  return complete
}

/**
 * Easiest first: fewer words, then commoner words.
 *
 * The rarest word in the phrase is what decides the second half — a five-word
 * sentence is as hard as the one word in it nobody has met.
 */
function difficulty(phrase, rank, lang) {
  const inside = words(phrase, lang)
  const rarest = Math.max(...inside.map((word) => rank.get(word) ?? 3000))
  return [inside.length, rarest]
}

async function frequencyRanks(ngslPath) {
  const rank = new Map()
  for (const row of rows(await readFile(ngslPath, 'utf8'))) {
    const lemma = (row.Lemma ?? '').toLowerCase()
    const sfi = Number(row['SFI Rank'])
    if (lemma && Number.isFinite(sfi)) rank.set(lemma, sfi)
  }
  return rank
}

async function main() {
  const lang = arg('lang', 'en')
  if (!PACK_EXPORTS[lang]) {
    console.error(`No Tatoeba export mapped for '${lang}'. Add it to PACK_EXPORTS.`)
    process.exit(1)
  }
  const locales = localesFor(lang)
  // English can ask for every column; nothing else can. See `tatoeba`.
  const required = arg('require', lang === 'en' ? Object.keys(locales).join(',') : 'en').split(',')
  for (const locale of required) {
    if (!locales[locale]) {
      console.error(`Not a gloss column for a ${lang} pack: ${locale}.`)
      process.exit(1)
    }
  }

  const profiles = args('profile')
  const ngslPath = arg('ngsl')
  const statsPath = arg('ngsl-stats', ngslPath)
  const frequencyPath = arg('frequency')
  // Deduplicated: B1 and B2 are both `intermediate`, C1 and C2 both `fluent`,
  // so the bands are six and the levels are four.
  const levels = [...new Set(arg('levels', Object.values(LEVELS).join(',')).split(','))]
  const limit = Number(arg('limit', '300'))
  const outDir = arg('out-dir')
  if (!outDir || (lang === 'en' ? profiles.length === 0 || !ngslPath : !frequencyPath)) {
    console.error(
      lang === 'en'
        ? 'Need --profile, --ngsl and --out-dir. See the header of this file.'
        : 'Need --frequency and --out-dir. See the header of this file.',
    )
    process.exit(1)
  }
  for (const level of levels) {
    if (!Object.values(LEVELS).includes(level)) {
      console.error(
        `Not a level: ${level}. One of ${[...new Set(Object.values(LEVELS))].join(', ')}.`,
      )
      process.exit(1)
    }
  }

  const graded =
    lang === 'en' ? await gradedWords(profiles, ngslPath) : await frequencyBands(frequencyPath)
  const rank =
    lang === 'en' ? await frequencyRanks(statsPath) : await frequencyRanksFrom(frequencyPath)
  console.error(`graded ${graded.size} ${lang} word forms`)

  const book = await phrasebook(arg('phrasebook'))
  const cues = await cued(arg('cues'))
  const sentences = await tatoeba(
    graded,
    levels,
    lang,
    locales,
    required,
    arg('tatoeba', 'https://downloads.tatoeba.org/exports/per_language'),
  )

  for (const level of levels) {
    const entries = book.filter((phrase) => levelOf(phrase, graded, lang) === level)
    const said = sentences.get(level) ?? []
    console.error(`\n${level}: ${entries.length} phrasebook, ${said.length} Tatoeba`)

    const seen = new Set()
    const candidates = []
    // The phrasebook first: a set expression is worth more to somebody meeting
    // the level than a well-formed sentence, and there are only ever a few.
    for (const phrase of [...entries, ...said.map((item) => item.text)]) {
      const key = shape(phrase)
      if (!key || seen.has(key) || !writable(phrase) || !isPhrase(phrase)) continue
      // Before the limit, not after it: a phrase with no picture gives its
      // place to the next candidate rather than leaving a hole in the pack.
      if (cues && !cues.has(phrase)) continue
      seen.add(key)
      candidates.push(phrase)
    }

    const bookSet = new Set(entries)
    const covers = new Map(said.map((item) => [item.text, item.covers ?? 0]))
    const byDifficulty = (a, b) => {
      // Both halves are sorted by difficulty, but the phrasebook stays in front.
      const side = Number(bookSet.has(b)) - Number(bookSet.has(a))
      if (side !== 0) return side
      const [aWords, aRare] = difficulty(a, rank, lang)
      const [bWords, bRare] = difficulty(b, rank, lang)
      return aWords - bWords || aRare - bRare || a.localeCompare(b)
    }
    /*
     * Which sentences get in, and what order they are in, are two questions
     * and used to be one sort. A place in the pack goes to the sentence that
     * is glossed into the most locales, because that is the only way the thin
     * columns — Arabic everywhere, Turkish outside Europe — fill at all when
     * the floor is English alone. The order is then difficulty again, because
     * the pack's order is the order a learner meets it in.
     */
    const byCoverage = (a, b) => {
      const side = Number(bookSet.has(b)) - Number(bookSet.has(a))
      if (side !== 0) return side
      const gap = (covers.get(b) ?? 0) - (covers.get(a) ?? 0)
      return gap !== 0 ? gap : byDifficulty(a, b)
    }

    // Coverage decides who is in, difficulty decides the order, and `spread`
    // then stops two neighbours opening with the same word — which is the
    // defect a session of ten makes visible and nothing else would catch.
    const taken = spread(
      [...candidates].sort(byCoverage).slice(0, limit).sort(byDifficulty),
      opening,
    )
    const glosses = {}
    for (const item of said) if (taken.includes(item.text)) glosses[item.text] = item.gloss

    const out = join(outDir, `${level}.txt`)
    const glossesOut = join(outDir, `${level}.glosses.json`)
    await mkdir(outDir, { recursive: true })
    await writeFile(out, `${taken.join('\n')}\n`, 'utf8')
    await writeFile(glossesOut, `${JSON.stringify(glosses, null, 2)}\n`, 'utf8')
    const covered = taken.map((phrase) => covers.get(phrase)).filter(Boolean)
    console.error(
      `  wrote ${taken.length} phrases to ${out} ` +
        `(${taken.filter((phrase) => bookSet.has(phrase)).length} from the phrasebook) ` +
        `and ${Object.keys(glosses).length} prepared glosses to ${glossesOut}` +
        (covered.length > 0
          ? `, ${(covered.reduce((a, b) => a + b, 0) / covered.length).toFixed(1)} locales each.`
          : '.'),
    )
  }
}

void main()
