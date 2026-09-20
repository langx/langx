/**
 * Drafts a pack file from a word list.
 *
 * For each word it reads the entry out of **kaikki.org**, the machine-readable
 * extraction of Wiktionary (wiktextract). One request returns every sense with
 * its own definition and examples, every translation tagged with the sense it
 * belongs to, and the pronunciation recordings Wiktionary links — where the
 * previous version of this file pulled raw wikitext and picked the
 * `{{trans-top|…}}` blocks apart with regular expressions.
 *
 * That change is what makes the draft readable. The sense a translation
 * belongs to arrives as a field rather than as whatever the surrounding markup
 * happened to say, so the file can carry the definition beside every gloss and
 * a person can check it.
 *
 * **It still drafts.** Choosing the sense mechanically is the thing that does
 * not work — see `content/echo/ATTRIBUTION.md` for both measurements — so the
 * file is always written `"reviewed": false` and `seed-echo-packs.ts` refuses
 * to write a file that says that.
 *
 * Usage:
 *   node tools/echo-content/build-pack.mjs \
 *     --words ./words.txt --lang en --level absoluteBeginner \
 *     --out content/echo/en/absoluteBeginner.json \
 *     --source 'CEFR-J Vocabulary Profile 1.5|Free for research and commercial use with citation|http://www.cefr-j.org/'
 *
 * `--words` is one entry per line: `word` or `word\tPartOfSpeech`. Blank lines
 * and lines starting with `#` are skipped, and the order of the file is the
 * order of the pack — feed it a frequency list.
 *
 * `--source` names a source the *word list* came from, as `name|licence|url`.
 * Repeatable. kaikki is added on its own; everything else has to be said,
 * because a pack's `sources` array is the licence record for the file.
 *
 * `--lang` also picks the kaikki edition — see `EDITIONS`. A language that is
 * not English is read from its own Wiktionary, because en.wiktionary has no
 * translation table for anything but English.
 *
 * `--glosses` is a prepared `{ "<text>": { "<locale>": "…" } }` map, written by
 * `pick-phrases.mjs`. A line found in it is glossed from it and never looked
 * up: no dictionary has an entry for "Why do you ask?", and the translation of
 * a sentence has to come from a person who wrote one, not from a machine
 * choosing a sense. Everything else falls through to kaikki as before.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { writable } from './text.mjs'

/** Interface locale → the language code Wiktionary tags a translation with. */
const LOCALE_CODES = {
  en: 'en',
  tr: 'tr',
  de: 'de',
  es: 'es',
  fr: 'fr',
  'pt-BR': 'pt',
  ru: 'ru',
  ar: 'ar',
}

/**
 * The columns a pack in `lang` is glossed into: the eight interface locales
 * less the pack's own language, which is the side the learner is reading
 * rather than the side they are told.
 */
function localesFor(lang) {
  return Object.fromEntries(Object.entries(LOCALE_CODES).filter(([, code]) => code !== lang))
}

/**
 * The language a pack is in → the kaikki edition to read it from.
 *
 * English is the odd one and the reason this is a table of URLs rather than of
 * names. A translation table lives only on an English-language entry of
 * en.wiktionary, so `kaikki.org/dictionary/<Language>` — that wiki indexed by
 * the language of the word — answers with translations for English and with
 * none at all for anything else: `buenos días`, `guten Tag` and `bonjour` all
 * come back with an empty `translations`. Every other language is read from
 * its own Wiktionary, where its own entries are the ones carrying tables.
 */
const EDITIONS = {
  en: 'https://kaikki.org/dictionary/English',
  es: 'https://kaikki.org/eswiktionary/Español',
  de: 'https://kaikki.org/dewiktionary/Deutsch',
  fr: 'https://kaikki.org/frwiktionary/Français',
  ru: 'https://kaikki.org/ruwiktionary/Русский',
  it: 'https://kaikki.org/itwiktionary/Italiano',
}

/** A words file says `noun`; kaikki says `noun`, `adj`, `intj`. */
const PARTS_OF_SPEECH = {
  noun: 'noun',
  verb: 'verb',
  adjective: 'adj',
  adverb: 'adv',
  preposition: 'prep',
  pronoun: 'pron',
  determiner: 'det',
  conjunction: 'conj',
  interjection: 'intj',
  number: 'num',
}

const UA = 'langx-echo-content/2.0 (https://langx.io; hi@langx.io)'
/** A static file host, but still somebody's bandwidth. One at a time. */
const PAUSE_MS = 200

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * The entries for one word: one per part of speech and etymology.
 *
 * The path keeps the word's own case — `T/Tu/Tuesday.jsonl`, not `t/tu/…` —
 * which is why nothing here lowercases.
 */
async function entries(word, edition) {
  const path = `${encodeURIComponent(word[0])}/${encodeURIComponent(word.slice(0, 2))}/${encodeURIComponent(word)}`
  const response = await fetch(`${edition}/meaning/${path}.jsonl`, {
    headers: { 'user-agent': UA },
  })
  if (!response.ok) return []
  const body = await response.text()
  return body
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line))
}

/**
 * Translations grouped by the sense they were filed under.
 *
 * Across every entry unless a part of speech is asked for and some entry has
 * it — a words file saying `noun` is a hint, and a hint that matches nothing
 * must not empty the result. That is the failure the wikitext version had when
 * it scoped its search: three wrong answers became three missing ones.
 */
function sensesWithTranslations(found, partOfSpeech) {
  const wanted = partOfSpeech && PARTS_OF_SPEECH[partOfSpeech]
  const scope =
    wanted && found.some((entry) => entry.pos === wanted)
      ? found.filter((entry) => entry.pos === wanted)
      : found

  const groups = new Map()
  for (const entry of scope) {
    for (const translation of entry.translations ?? []) {
      if (!translation.word) continue
      const meaning = senseOf(entry, translation)
      if (!meaning?.label) continue
      const group = groups.get(meaning.label) ?? {
        sense: meaning.label,
        // The sense object itself where the edition linked one, so the
        // definition and the examples do not have to be guessed back.
        known: meaning.sense,
        entry,
        translations: [],
      }
      group.translations.push(translation)
      groups.set(meaning.label, group)
    }
  }
  return [...groups.values()]
}

/**
 * Which sense a translation belongs to — three shapes, one answer.
 *
 * en.wiktionary writes the sense on the translation as text, and that is what
 * this file was built around. The other editions do not: es and fr carry a
 * `sense_index` pointing into `senses[]`, and it carries nothing at all.
 *
 * Unlinked translations on an entry with **one** sense are still attributable,
 * because there is no choice to make. On an entry with several they are not,
 * and this returns null rather than attaching them to the first — guessing
 * which meaning a word was translated under is the one thing this file exists
 * not to do.
 */
function senseOf(entry, translation) {
  const senses = entry.senses ?? []
  if (translation.sense_index) {
    const match = senses.find((sense) => sense.sense_index === translation.sense_index)
    if (match) return { label: match.glosses?.at(-1), sense: match }
  }
  if (translation.sense) return { label: translation.sense, sense: null }
  if (senses.length === 1) return { label: senses[0].glosses?.at(-1), sense: senses[0] }
  return null
}

/**
 * The draft sense: the one the most languages bothered to translate.
 *
 * Wiktionary orders senses by etymology and age, not by use, which is how
 * `train` leads with the back of a dress. How many languages have a word for a
 * sense is the closest thing to a usage signal the data carries, and on the six
 * words `ATTRIBUTION.md` measures it gets all six right where taking the first
 * got three.
 */
function draftSense(groups) {
  return groups.reduce(
    (best, group) => (!best || group.translations.length > best.translations.length ? group : best),
    null,
  )
}

function glossFrom(group, locales, lang) {
  const gloss = {}
  for (const [locale, code] of Object.entries(locales)) {
    const match = group.translations.find(
      (translation) => translation.lang_code === code && writable(translation.word),
    )
    if (match) gloss[locale] = match.word
  }
  // On an English pack the English column is the sense label — Wiktionary's own
  // summary, which is what a definition on the known side should be, and what
  // `glossFor` falls back to. Anywhere else `en` is a translation like the
  // other seven and was filled above; the label there is written in that
  // wiki's own language and would put Italian on an Italian card's back.
  if (lang === 'en') gloss.en = group.sense
  return gloss
}

const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'of',
  'or',
  'to',
  'in',
  'on',
  'and',
  'that',
  'is',
  'for',
])

function contentWords(text) {
  return new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}]+/u)
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word)),
  )
}

/**
 * The definition behind a sense label, and an example of it.
 *
 * A translation carries a short label (`line of connected cars or carriages`)
 * and a definition lives on `senses[]` — the two are written by different
 * editors and never match exactly, so they are matched on shared words. Below
 * two in common nothing is claimed: an example sentence filed under the wrong
 * sense teaches the wrong thing, which is the whole reason this file drafts.
 */
function definitionFor(entry, sense, known) {
  if (known) {
    const example = known.examples?.find((item) => item.text && !item.ref && writable(item.text))
    return {
      ...(known.glosses?.at(-1) ? { definition: known.glosses.at(-1) } : {}),
      ...(example ? { example: example.text } : {}),
    }
  }
  const label = contentWords(sense)
  let best = null
  for (const candidate of entry.senses ?? []) {
    const gloss = candidate.glosses?.at(-1)
    if (!gloss) continue
    const shared = [...contentWords(gloss)].filter((word) => label.has(word)).length
    if (shared >= 2 && (!best || shared > best.shared)) best = { shared, gloss, sense: candidate }
  }
  if (!best) return null
  // Plain usage examples only. A dated literary quotation is evidence the word
  // existed in 1803, not a sentence to put on a card — and `writable` is what
  // catches the ones that carry no `ref` and are a citation anyway, or that are
  // two lines of dialogue rather than one sentence.
  const example = best.sense.examples?.find((item) => item.text && !item.ref && writable(item.text))
  return { definition: best.gloss, ...(example ? { example: example.text } : {}) }
}

/**
 * A human saying the word, where Wiktionary links one.
 *
 * Left in `review` rather than promoted here, and still deliberately: these
 * are candidates, and which one may go on a card depends on a licence this
 * script never asks about. `add-audio.mjs` looks each file up on Commons,
 * keeps the ones whose terms allow it, and writes the chosen one — with the
 * credit its licence requires — to the item's `audio`.
 *
 * The order matters and is this function's contribution: Lingua Libre first,
 * because that is one named speaker per file, and `add-audio.mjs` promotes the
 * first candidate that passes.
 */
function recordings(found) {
  const heard = []
  for (const entry of found) {
    for (const sound of entry.sounds ?? []) {
      if (sound.mp3_url && !heard.some((item) => item.url === sound.mp3_url)) {
        heard.push({ url: sound.mp3_url, file: sound.audio, tags: sound.tags ?? [] })
      }
    }
  }
  // Lingua Libre first: one named speaker per file, and the licence we checked.
  return heard.sort((a, b) => Number(b.file?.startsWith('LL-')) - Number(a.file?.startsWith('LL-')))
}

/**
 * The entry a phrase is an alternative spelling of, if it is one.
 *
 * `what's your name` carries a definition and no translations, because the
 * table is on `what is your name`; a third of the phrasebook entries that
 * resolved to nothing were this. Followed once and no further — a chain of
 * alternative forms is a redirect loop waiting to happen, and one hop is what
 * the data actually uses.
 */
function alternativeOf(found) {
  for (const entry of found) {
    for (const sense of entry.senses ?? []) {
      const alt = (sense.alt_of ?? sense.form_of ?? [])[0]?.word
      if (alt) return alt
    }
  }
  return null
}

function parseSource(value) {
  const [name, licence, url] = value.split('|').map((part) => part.trim())
  if (!name || !licence || !url) {
    console.error(`--source wants 'name|licence|url', got: ${value}`)
    process.exit(1)
  }
  return { name, licence, url }
}

async function main() {
  const wordsPath = arg('words')
  const lang = arg('lang')
  const level = arg('level', 'absoluteBeginner')
  const out = arg('out')
  if (!wordsPath || !lang || !out) {
    console.error('Need --words, --lang and --out. See the header of this file.')
    process.exit(1)
  }
  const edition = EDITIONS[lang]
  if (!edition) {
    console.error(`No kaikki edition mapped for '${lang}'. Add it to EDITIONS.`)
    process.exit(1)
  }
  const locales = localesFor(lang)

  const lines = (await readFile(wordsPath, 'utf8'))
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))

  const glossesPath = arg('glosses')
  const prepared = glossesPath ? JSON.parse(await readFile(glossesPath, 'utf8')) : {}

  const items = []
  let missing = 0
  let fromPrepared = 0
  for (const [index, line] of lines.entries()) {
    const [text, partOfSpeech] = line.split('\t')

    const ready = prepared[text]
    if (ready) {
      fromPrepared += 1
      items.push({
        index: items.length,
        kind: text.includes(' ') ? 'phrase' : 'word',
        text,
        gloss: ready,
        freqRank: index + 1,
        // A sentence *is* its own example, the way a card captured from a chat
        // is, so nothing fills `example` here. What the reviewer checks is the
        // translation, and there is no sense to second-guess.
        review: { glossedBy: 'Tatoeba' },
      })
      continue
    }

    let found = await entries(text, edition)
    await sleep(PAUSE_MS)
    let groups = sensesWithTranslations(found, partOfSpeech)
    let alternativeFor = null

    if (groups.length === 0) {
      const canonical = alternativeOf(found)
      if (canonical) {
        alternativeFor = canonical
        found = await entries(canonical, edition)
        await sleep(PAUSE_MS)
        groups = sensesWithTranslations(found, partOfSpeech)
      }
    }

    const chosen = draftSense(groups)
    if (!chosen) {
      missing += 1
      console.error(`  no translations: ${text}`)
      continue
    }

    const context = definitionFor(chosen.entry, chosen.sense, chosen.known)
    const heard = recordings(found)
    items.push({
      index: items.length,
      kind: text.includes(' ') ? 'phrase' : 'word',
      text,
      ...(partOfSpeech ? { partOfSpeech } : {}),
      gloss: glossFrom(chosen, locales, lang),
      ...(context?.example ? { example: context.example } : {}),
      freqRank: index + 1,
      // Everything the reviewer needs to agree or disagree, and nothing the
      // app reads: the seed validates against the schema, which drops it.
      review: {
        sense: chosen.sense,
        translationCount: chosen.translations.length,
        ...(context?.definition ? { definition: context.definition } : {}),
        otherSenses: groups
          .filter((group) => group !== chosen)
          .sort((a, b) => b.translations.length - a.translations.length)
          .slice(0, 5)
          .map((group) => `${group.sense} (${group.translations.length})`),
        ...(heard.length > 0 ? { audio: heard.slice(0, 3) } : {}),
        // The gloss describes this entry, and the card says something else.
        ...(alternativeFor ? { glossedFrom: alternativeFor } : {}),
      },
    })
    if (items.length % 25 === 0) console.error(`  ${items.length} drafted…`)
  }

  const pack = {
    id: `${lang}:${level}`,
    lang,
    level,
    contentVersion: 1,
    /** The gate. `seed-echo-packs.ts` refuses to write a file that says false. */
    reviewed: false,
    sources: [
      {
        name: 'Wiktionary, via kaikki.org (wiktextract)',
        licence: 'CC BY-SA 4.0',
        url: 'https://kaikki.org/',
      },
      ...(fromPrepared > 0
        ? [{ name: 'Tatoeba', licence: 'CC BY 2.0 FR', url: 'https://tatoeba.org/' }]
        : []),
      ...args('source').map(parseSource),
    ],
    items,
  }

  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, `${JSON.stringify(pack, null, 2)}\n`, 'utf8')
  console.error(
    `\nWrote ${items.length} items to ${out} ` +
      `(${fromPrepared} glossed from ${glossesPath ?? 'nothing'}, ${missing} had no translations).`,
  )
  // The floor the content test enforces: outside an English pack, an item with
  // no English gloss has nothing for `glossFor` to fall back to and shows its
  // own front on both sides. Named here rather than dropped, because a
  // reviewer who knows the language can write the one line that saves it.
  if (lang !== 'en') {
    const bare = items.filter((item) => !item.gloss.en)
    if (bare.length > 0) {
      console.error(
        `${bare.length} have no English gloss and cannot be seeded as they are:\n` +
          bare.map((item) => `  ${item.text}`).join('\n'),
      )
    }
  }
  console.error('Marked reviewed: false. A person reads it before it can be seeded.')
}

void main()
