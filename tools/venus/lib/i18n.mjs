// The words under the number, in the app's own wording: `streak.heroUnit` from
// apps/mobile/src/i18n/messages/<locale>.ts, the unit the app draws beside the big streak number.
// It is a plural, so the right form is picked with the CLDR rules (Intl.PluralRules), the same
// categories the app's catalogues are written in (ru one/few/many, ar zero/one/two/few/many/other).
//
// The app repo is only read. `node lib/i18n.mjs --sync` copies the words into data/streak-unit.json,
// which is what renders use, so a render never depends on a checkout being present.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { REPO } from './paths.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DATA = path.join(HERE, '../data/streak-unit.json')
// the checkout this tool lives in, unless LANGX_APP names another one
export const APP = process.env.LANGX_APP || REPO
const LOCALES = ['tr', 'en', 'es', 'fr', 'de', 'ru', 'ar', 'pt-BR']

function readHeroUnit(lang) {
  const src = fs.readFileSync(path.join(APP, 'apps/mobile/src/i18n/messages', `${lang}.ts`), 'utf8')
  const i = src.indexOf('heroUnit:')
  if (i < 0) throw new Error(`${lang}: no streak.heroUnit`)
  const body = src.slice(src.indexOf('{', i) + 1, src.indexOf('}', i))
  const out = {}
  for (const m of body.matchAll(/(\w+):\s*'([^']*)'/g)) out[m[1]] = m[2]
  return out
}

export function sync() {
  const data = {
    source: 'apps/mobile/src/i18n/messages/<locale>.ts → streak.heroUnit',
    copiedAt: new Date().toISOString().slice(0, 10),
    units: {},
  }
  for (const l of LOCALES) data.units[l] = readHeroUnit(l)
  fs.mkdirSync(path.dirname(DATA), { recursive: true })
  fs.writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n')
  return data
}

let cache = null
const units = () =>
  (cache =
    cache || JSON.parse(fs.readFileSync(fs.existsSync(DATA) ? DATA : (sync(), DATA), 'utf8')).units)

// "22" in the locale's digits as the app shows them (Latin digits everywhere, Arabic included)
export const formatNumber = (n, lang) =>
  new Intl.NumberFormat(lang, { numberingSystem: 'latn' }).format(n)
export function streakUnit(n, lang) {
  const u = units()[lang]
  const cat = new Intl.PluralRules(lang).select(n)
  return u[cat] ?? u.other
}
// the label is set in caps under the number; Turkish needs its own dotted İ
export const streakLabel = (n, lang) => streakUnit(n, lang).toLocaleUpperCase(lang)
export const isRTL = (lang) => lang === 'ar'

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--sync')) console.log('wrote', DATA, sync().units)
  for (const l of LOCALES)
    console.log(
      l.padEnd(6),
      [1, 2, 3, 5, 11, 22, 100, 365]
        .map((n) => `${formatNumber(n, l)} ${streakLabel(n, l)}`)
        .join(' | '),
    )
}
