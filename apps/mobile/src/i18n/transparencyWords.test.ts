import { SUPPORTED_LOCALES, type Catalog, type Locale } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { catalogs } from './catalogs'

/**
 * Words the Transparency page must never say (plan items 7 and 8), in every
 * language it is read in.
 *
 * - **End-to-end encryption.** LangX's messages are not end-to-end encrypted,
 *   and a page about trust is the worst place for the phrase to slip in as a
 *   claim. It appears once, in the question that asks it, whose answer
 *   begins "No." — so the question is the one allowed place, and the answer
 *   itself must not repeat it.
 * - **"100%"**, the shape of "100% secure": no system is, and the page
 *   promises only what the code does.
 * - **Hostnames**, and **where the database lives**: the page names no
 *   server, no provider and no region. Its one address, insight.langx.io on
 *   the link card, is read off the URL the card opens, not from these words.
 */

/** Each language's way of saying "end-to-end", so a translation cannot reintroduce it. */
const END_TO_END = [
  /end-to-end/i,
  /ende-zu-ende/i,
  /extremo a extremo/i,
  /bout en bout/i,
  /ponta a ponta/i,
  /сквозн/i,
  /uçtan uca/i,
  /طرف إلى طرف/,
]

const ALWAYS = [
  // "100% secure" in any word order: "100 %", "%100" (Turkish), "١٠٠٪".
  /100\s?[%٪]|[%٪]\s?100|١٠٠/,
  // A hostname: a word, a dot, a top-level domain.
  /\b[\w-]+\.(?:io|com|net|org|app|dev|ai|co)\b/i,
  // Who hosts what, and where.
  /mongo|atlas|fly\.io|\baws\b|amazon|azure|google cloud|frankfurt|backblaze|cloudflare/i,
]

/** The one key the phrase may appear in. */
const ASKS_ABOUT_IT = 'qE2E'

function leaves(node: Catalog | string, prefix = ''): [string, string][] {
  if (typeof node === 'string') return [[prefix, node]]
  return Object.entries(node).flatMap(([key, value]) =>
    leaves(value as Catalog | string, prefix ? `${prefix}.${key}` : key),
  )
}

function pageWords(locale: Locale): [string, string][] {
  const page = (catalogs[locale] as unknown as { transparency: { page: Catalog } }).transparency
    .page
  return leaves(page)
}

describe.each(SUPPORTED_LOCALES)('the Transparency page in %s', (locale) => {
  const words = pageWords(locale)

  it('has words to check', () => {
    expect(words.length).toBeGreaterThan(50)
  })

  it('says "end-to-end" only in the question that asks it', () => {
    const said = words.filter(([, text]) => END_TO_END.some((pattern) => pattern.test(text)))
    expect(said.map(([key]) => key)).toEqual([ASKS_ABOUT_IT])
  })

  it('claims no "100%", names no host, and says nothing of where the data lives', () => {
    const said = words.filter(([, text]) => ALWAYS.some((pattern) => pattern.test(text)))
    expect(said).toEqual([])
  })
})
