/**
 * Names the glosses worth looking at, in a corpus too big to read twice.
 *
 * The three English packs are 809 items across eight locales, about 5,600
 * glosses, and five more languages is five times that. The review that found
 * the most was the third English pass, which read Russian and Arabic line by
 * line and found ninety-five defects — and most of them were not judgements.
 * They were classes: a Persian _yeh_ in an Arabic word, a Latin comma, a space
 * before a question mark, a hyphen where an em dash belongs, the scraped word
 * "Translations", dictionary notation carried onto a card back. Every one of
 * those is a rule.
 *
 * **It flags, it never edits, and it never decides what a line means.** A
 * wrong sense and a translation of a different sentence are exactly what this
 * cannot see; a person still reads the file. What this buys is that the person
 * does not spend the first pass finding the mechanical ones by eye. See
 * `docs/decisions.md` — "a machine may not choose what a line means".
 *
 * Usage:
 *   node tools/echo-content/lint-glosses.mjs             # every pack
 *   node tools/echo-content/lint-glosses.mjs es          # one language
 *   node tools/echo-content/lint-glosses.mjs --locale ar # one column
 *
 * The argument is a language, not a path — every file this opens is one
 * `content/echo` listed itself. Reading a path off the command line is the
 * same code either way and CodeQL is right that it is not the same risk.
 */
import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const CONTENT = resolve(import.meta.dirname, '../../content/echo')

/** The script a locale is written in, where there is one to check against. */
const SCRIPTS = {
  ru: /\p{Script=Cyrillic}/u,
  ar: /\p{Script=Arabic}/u,
}

/**
 * Every rule, as `[name, test]`. A test is `(text, item, locale, pack)` and
 * returns a reason or nothing.
 *
 * Each one is here because it was found by hand in a pack that had already
 * been reviewed once — the comment beside it is the case, not a hypothesis.
 *
 * **A gloss in the pack's own language is a definition, not a translation**,
 * and two rules have to know that: English glosses on an English pack are
 * Wiktionary's sense labels, which are routinely longer than the phrase and
 * occasionally equal to it. Run without the exemption they were 143 of the
 * 264 things this had to say, all of them correct content.
 */
const RULES = [
  // `(eu)`, `(usted)`, `(você)`, `(-e, -a, -ye, -ya, -ne)`: which form the
  // dictionary was listing, on the back of a card where it means nothing.
  ['notation', (text) => /\((?:eu|você|usted|tú|vos|ihr|du|[-–][^)]*)\)/i.test(text) && text],
  // Twelve English glosses were the scraped heading of the table they came from.
  ['scraped', (text) => /^translations?$/i.test(text.trim()) && text],
  // A back that repeats the front teaches nothing and is usually a fallthrough.
  [
    'same as the front',
    (text, item, locale, pack) => locale !== pack.lang && text.trim() === item.text.trim() && text,
  ],
  [
    'blank or padded',
    (text) => (text !== text.trim() || /\s{2,}/.test(text)) && JSON.stringify(text),
  ],
  ['newline', (text) => text.includes('\n') && JSON.stringify(text)],
  // "It's too big." glossed with an unrelated Tatoeba sentence about Tom: the
  // wrong sentence is usually the longer one, and length is what a rule can see.
  [
    'three times the front',
    (text, item, locale, pack) =>
      locale !== pack.lang && item.text.length >= 8 && text.length > item.text.length * 3 && text,
  ],
  ['unbalanced brackets', (text) => count(text, '(') !== count(text, ')') && text],
  // Arabic and Russian glosses written with the neighbouring language's letters.
  ['Persian letter', (text, _item, locale) => locale === 'ar' && /[یکگپ]/.test(text) && text],
  [
    'Latin punctuation in Arabic',
    (text, _item, locale) => locale === 'ar' && /[,;?]/.test(text) && text,
  ],
  // Arabic only. French puts a space before `?` and `!` on purpose, and that
  // rule, run over everything, was 121 of the first run's 264 findings.
  [
    'space before punctuation',
    (text, _item, locale) => locale === 'ar' && /\s[،؛؟!?.](?:\s|$)/.test(text) && text,
  ],
  // ` - ` for ` — `, and a word carrying two stress marks.
  ['hyphen for a dash', (text, _item, locale) => locale === 'ru' && /\s-\s/.test(text) && text],
  ['doubled stress', (text) => /́[^\s]*́/.test(text) && text],
  ['wrong script', (text, _item, locale) => SCRIPTS[locale] && !SCRIPTS[locale].test(text) && text],
  // A Latin word sitting inside an Arabic or Russian gloss, which is how an
  // untranslated fragment survives a column that otherwise looks right.
  ['Latin letters', (text, _item, locale) => SCRIPTS[locale] && /[A-Za-z]{2,}/.test(text) && text],
]

function count(text, character) {
  return [...text].filter((one) => one === character).length
}

/** Every pack file, or every pack file of one language. */
async function packs(lang) {
  const found = []
  for (const dir of await readdir(CONTENT, { withFileTypes: true })) {
    if (!dir.isDirectory() || (lang && dir.name !== lang)) continue
    for (const file of await readdir(join(CONTENT, dir.name))) {
      if (file.endsWith('.json')) found.push(join(CONTENT, dir.name, file))
    }
  }
  return found
}

async function main() {
  const only = process.argv.includes('--locale')
    ? process.argv[process.argv.indexOf('--locale') + 1]
    : null
  const lang = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null

  const found = (await packs(lang)).sort()
  if (found.length === 0) {
    console.error(lang ? `No packs in content/echo/${lang}.` : 'No packs at all.')
    process.exitCode = 1
    return
  }

  const totals = new Map()
  let read = 0
  for (const path of found) {
    const pack = JSON.parse(await readFile(path, 'utf8'))
    const flagged = []
    for (const item of pack.items) {
      for (const [locale, text] of Object.entries(item.gloss ?? {})) {
        if (only && locale !== only) continue
        read += 1
        for (const [name, test] of RULES) {
          const found = test(text, item, locale, pack)
          if (!found) continue
          flagged.push(`  ${String(item.index).padStart(4)} ${locale} ${name}: ${found}`)
          totals.set(name, (totals.get(name) ?? 0) + 1)
        }
      }
    }
    console.log(`${pack.id}: ${flagged.length} to look at, of ${pack.items.length} items`)
    for (const line of flagged) console.log(line)
  }

  console.log(`\nread ${read} glosses`)
  for (const [name, n] of [...totals].sort((a, b) => b[1] - a[1])) console.log(`  ${n} ${name}`)
  if (totals.size === 0) console.log('  nothing a rule can see — which is not the same as clean')
}

void main()
