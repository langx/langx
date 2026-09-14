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
 * - **Wiktionary's English phrasebook** (`Category:English phrasebook`) is 460
 *   everyday expressions — _excuse me_, _be careful_, _can I come in_ — each a
 *   dictionary entry with translations somebody curated. `build-pack.mjs`
 *   glosses these the same way it glosses a word. The category listing is an
 *   input rather than something this fetches: Wikimedia rate-limits the API
 *   hard from a shared address, and a run that fails on the fourth 429 after
 *   twenty minutes of streaming Tatoeba is a run nobody repeats.
 * - **Tatoeba** is short sentences with human translations into the eight
 *   locales. No dictionary has an entry for "Why do you ask?", and no machine
 *   should be inventing one, so the translation comes from the person who
 *   wrote it. Those glosses are written out here and handed to `build-pack.mjs`.
 *
 * **Level is the level of the hardest word in the phrase**, looked up in a
 * CEFR profile and mapped onto our four by the same table
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
 * Usage — the category listing first, saved exactly as the API returns it:
 *
 *   curl -s 'https://en.wiktionary.org/w/api.php?action=query&list=categorymembers&cmtitle=Category:English%20phrasebook&cmlimit=500&cmnamespace=0&format=json&formatversion=2' -o ./phrasebook.json
 *
 *   node tools/echo-content/pick-phrases.mjs \
 *     --profile ./cefrj-vocabulary-profile-1.5.csv \
 *     --profile ./octanove-vocabulary-profile-c1c2-1.0.csv \
 *     --ngsl ./NGSL_12_lemmatized_for_teaching.csv --ngsl-stats ./NGSL_12_stats.csv \
 *     --phrasebook ./phrasebook.json --limit 300 --out-dir ./picked
 *
 * Writes `<level>.txt` and `<level>.glosses.json` per level into `--out-dir`,
 * for every level unless `--levels` names some. Leave `--phrasebook` off and the
 * packs are Tatoeba sentences only.
 *
 * Needs `bzip2` on the path: Tatoeba publishes bz2 and node has no decoder for
 * it. Everything is streamed, so the exports are never written to disk.
 */

import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { writable } from './text.mjs'

/** Interface locale → the Tatoeba language directory that holds it. */
const LOCALES = {
  tr: 'tur',
  de: 'deu',
  es: 'spa',
  fr: 'fra',
  'pt-BR': 'por',
  ru: 'rus',
  ar: 'ara',
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
 */
const MIN_WORDS = 3
const MAX_WORDS = 8

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

/** A bz2 export, decompressed and handed over a line at a time. */
async function* lines(url) {
  const curl = spawn('sh', ['-c', `curl -sS --max-time 900 -A '${UA}' '${url}' | bzip2 -dc`])
  curl.stderr.pipe(process.stderr)
  for await (const line of createInterface({ input: curl.stdout, crlfDelay: Infinity })) yield line
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

function words(phrase) {
  return (
    phrase
      .toLowerCase()
      .match(/[a-z']+/g)
      ?.flatMap((token) => CONTRACTIONS[token] ?? [token.replace(/^'|'$/g, '')])
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
function levelOf(phrase, graded) {
  const bands = []
  for (const word of words(phrase)) {
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
    .replace(/[^a-z0-9 ]/g, '')
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
 * Tatoeba sentences at the wanted level, with a translation in every locale.
 *
 * Every locale, not most: the gloss is the half a learner cannot check, and a
 * pack that silently falls back to English for Arabic readers is a pack that is
 * worse for them without saying so.
 */
async function tatoeba(graded, levels) {
  const english = new Map()
  const levelOfId = new Map()
  for await (const line of lines(
    'https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences.tsv.bz2',
  )) {
    const [id, , text] = line.split('\t')
    if (!text || !'.?!'.includes(text.at(-1))) continue
    const count = words(text).length
    if (count < MIN_WORDS || count > MAX_WORDS) continue
    const band = levelOf(text, graded)
    if (!band || !levels.includes(band)) continue
    english.set(id, text)
    levelOfId.set(id, band)
  }
  // One pass for every level asked for. Four passes would stream two hundred
  // megabytes four times to answer the same question with a different filter.
  console.error(`  tatoeba: ${english.size} English sentences across ${levels.join(', ')}`)

  const glosses = new Map()
  for (const [locale, code] of Object.entries(LOCALES)) {
    const wanted = new Map()
    for await (const line of lines(
      `https://downloads.tatoeba.org/exports/per_language/eng/eng-${code}_links.tsv.bz2`,
    )) {
      const [from, to] = line.split('\t')
      if (english.has(from) && to && !wanted.has(to)) wanted.set(to.trim(), from)
    }
    let found = 0
    for await (const line of lines(
      `https://downloads.tatoeba.org/exports/per_language/${code}/${code}_sentences.tsv.bz2`,
    )) {
      const [id, , text] = line.split('\t')
      const englishId = wanted.get(id)
      if (!englishId || !text?.trim()) continue
      const gloss = glosses.get(englishId) ?? {}
      if (gloss[locale]) continue
      gloss[locale] = text.trim()
      glosses.set(englishId, gloss)
      found += 1
    }
    console.error(`  tatoeba: ${locale} covers ${found}`)
  }

  const complete = new Map(levels.map((band) => [band, []]))
  for (const [id, gloss] of glosses) {
    if (Object.keys(gloss).length !== Object.keys(LOCALES).length) continue
    const text = english.get(id)
    // All of it or none of it: a sentence whose Russian is unusable is not a
    // sentence with six good glosses, it is a card that is blank for a reader.
    if (!writable(text) || !Object.values(gloss).every(writable)) continue
    complete.get(levelOfId.get(id))?.push({ text, gloss })
  }
  return complete
}

/**
 * Easiest first: fewer words, then commoner words.
 *
 * The rarest word in the phrase is what decides the second half — a five-word
 * sentence is as hard as the one word in it nobody has met.
 */
function difficulty(phrase, rank) {
  const inside = words(phrase)
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
  const profiles = args('profile')
  const ngslPath = arg('ngsl')
  const statsPath = arg('ngsl-stats', ngslPath)
  // Deduplicated: B1 and B2 are both `intermediate`, C1 and C2 both `fluent`,
  // so the bands are six and the levels are four.
  const levels = [...new Set(arg('levels', Object.values(LEVELS).join(',')).split(','))]
  const limit = Number(arg('limit', '300'))
  const outDir = arg('out-dir')
  if (profiles.length === 0 || !ngslPath || !outDir) {
    console.error('Need --profile, --ngsl and --out-dir. See the header of this file.')
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

  const graded = await gradedWords(profiles, ngslPath)
  const rank = await frequencyRanks(statsPath)
  console.error(`graded ${graded.size} word forms`)

  const book = await phrasebook(arg('phrasebook'))
  const sentences = await tatoeba(graded, levels)

  for (const level of levels) {
    const entries = book.filter((phrase) => levelOf(phrase, graded) === level)
    const said = sentences.get(level) ?? []
    console.error(`\n${level}: ${entries.length} phrasebook, ${said.length} Tatoeba`)

    const seen = new Set()
    const chosen = []
    const glosses = {}
    // The phrasebook first: a set expression is worth more to somebody meeting
    // the level than a well-formed sentence, and there are only ever a few.
    for (const phrase of [...entries, ...said.map((item) => item.text)]) {
      const key = shape(phrase)
      if (!key || seen.has(key) || !writable(phrase) || !isPhrase(phrase)) continue
      seen.add(key)
      chosen.push(phrase)
    }
    for (const item of said) glosses[item.text] = item.gloss

    const bookSet = new Set(entries)
    const ordered = chosen.sort((a, b) => {
      // Both halves are sorted by difficulty, but the phrasebook stays in front.
      const side = Number(bookSet.has(b)) - Number(bookSet.has(a))
      if (side !== 0) return side
      const [aWords, aRare] = difficulty(a, rank)
      const [bWords, bRare] = difficulty(b, rank)
      return aWords - bWords || aRare - bRare || a.localeCompare(b)
    })

    const taken = ordered.slice(0, limit)
    const out = join(outDir, `${level}.txt`)
    const glossesOut = join(outDir, `${level}.glosses.json`)
    await mkdir(outDir, { recursive: true })
    await writeFile(out, `${taken.join('\n')}\n`, 'utf8')
    await writeFile(glossesOut, `${JSON.stringify(glosses, null, 2)}\n`, 'utf8')
    console.error(
      `  wrote ${taken.length} phrases to ${out} ` +
        `(${taken.filter((phrase) => bookSet.has(phrase)).length} from the phrasebook) ` +
        `and ${Object.keys(glosses).length} prepared glosses to ${glossesOut}.`,
    )
  }
}

void main()
