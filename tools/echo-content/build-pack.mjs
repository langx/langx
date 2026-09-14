/**
 * Drafts a pack file from a word list.
 *
 * For each word it takes the sense-carrying translations out of the English
 * Wiktionary — the tables under `{{trans-top|<sense>}}` — and writes the
 * chosen sense beside every gloss, so that the file can be *read* rather than
 * trusted.
 *
 * It always writes `"reviewed": false`, and `seed-echo-packs.ts` refuses a
 * file that says that. Picking the right sense mechanically is the thing that
 * does not work — see `content/echo/ATTRIBUTION.md` for the measurement — so
 * the pipeline drafts and a person decides.
 *
 * Usage:
 *   node tools/echo-content/build-pack.mjs \
 *     --words ./words.txt --lang en --level absoluteBeginner \
 *     --out content/echo/en/absoluteBeginner.json
 *
 * `--words` is one entry per line: `word` or `word\tPartOfSpeech`. Blank lines
 * and lines starting with `#` are skipped, and the order of the file is the
 * order of the pack — feed it a frequency list.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

/** Interface locale → the language code Wiktionary's templates use. */
const LOCALES = {
  tr: 'tr',
  de: 'de',
  es: 'es',
  fr: 'fr',
  'pt-BR': 'pt',
  ru: 'ru',
  ar: 'ar',
}

const UA = 'langx-echo-content/1.0 (https://langx.io; hi@langx.io)'
/** Wikimedia asks for serial requests from a named agent. One at a time it is. */
const PAUSE_MS = 200

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index < 0 ? fallback : process.argv[index + 1]
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function wikitext(word) {
  const url =
    'https://en.wiktionary.org/w/api.php?action=parse&prop=wikitext&formatversion=2&format=json&page=' +
    encodeURIComponent(word)
  const response = await fetch(url, { headers: { 'user-agent': UA } })
  if (!response.ok) return null
  const body = await response.json()
  return body?.parse?.wikitext ?? null
}

/** The English entry alone — `==English==` up to the next language heading. */
function englishSection(text) {
  const start = text.indexOf('==English==')
  if (start < 0) return null
  const rest = text.slice(start + '==English=='.length)
  const next = rest.search(/\n==[^=]/)
  return next < 0 ? rest : rest.slice(0, next)
}

/**
 * Every translation table in the entry, with the sense each is under.
 *
 * All of them, not the first: the caller cannot choose correctly and neither
 * can this, so the file carries the alternatives and the reviewer picks.
 */
function senses(scope) {
  const found = []
  const marker = '{{trans-top|'
  let at = scope.indexOf(marker)
  while (at >= 0) {
    const senseEnd = scope.indexOf('}}', at)
    const blockEnd = scope.indexOf('{{trans-bottom}}', at)
    found.push({
      sense: scope.slice(at + marker.length, senseEnd).trim(),
      block: scope.slice(at, blockEnd < 0 ? at + 8000 : blockEnd),
    })
    at = scope.indexOf(marker, blockEnd < 0 ? at + marker.length : blockEnd)
  }
  return found
}

function translations(block) {
  const out = {}
  for (const [locale, code] of Object.entries(LOCALES)) {
    const matches = [...block.matchAll(new RegExp(`\\{\\{tt?\\+?\\|${code}\\|([^|}]+)`, 'g'))]
      .map((match) => match[1].trim())
      .filter(Boolean)
    if (matches[0]) out[locale] = matches[0]
  }
  return out
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

  const lines = (await readFile(wordsPath, 'utf8'))
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))

  const items = []
  let missing = 0
  for (const [index, line] of lines.entries()) {
    const [text, pos] = line.split('\t')
    const raw = await wikitext(text)
    await sleep(PAUSE_MS)
    const scope = raw && englishSection(raw)
    const options = scope ? senses(scope) : []
    if (options.length === 0) {
      missing += 1
      console.error(`  no translations: ${text}`)
      continue
    }

    // The first is the draft; the rest are what the reviewer is choosing
    // between, and they are in the file for exactly that reason.
    const chosen = options[0]
    items.push({
      index: items.length,
      kind: text.includes(' ') ? 'phrase' : 'word',
      text,
      ...(pos ? { partOfSpeech: pos } : {}),
      gloss: translations(chosen.block),
      freqRank: index + 1,
      review: {
        sense: chosen.sense,
        otherSenses: options.slice(1, 6).map((option) => option.sense),
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
        name: 'English Wiktionary',
        licence: 'CC BY-SA 4.0',
        url: 'https://en.wiktionary.org/',
      },
    ],
    items,
  }

  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, `${JSON.stringify(pack, null, 2)}\n`, 'utf8')
  console.error(`\nWrote ${items.length} items to ${out} (${missing} had no translations).`)
  console.error('Marked reviewed: false. A person reads it before it can be seeded.')
}

void main()
