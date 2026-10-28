#!/usr/bin/env node
/**
 * The store screenshots, end to end, in one command:
 *
 *   node tools/store-shots/run.mjs --out <dir> [--locales en,tr] [--reuse-web] [--skip-capture]
 *
 * 1. exports this checkout's web build, pointed at the isolated stack;
 * 2. starts the stack (in-memory replica set + API, seeded with @sofia's world);
 * 3. captures every shot's screen per locale with headless Chrome;
 * 4. composes every slot at its exact size, plus the Play feature graphic;
 * 5. checks every file (size, PNG, no alpha, count per slot) and writes
 *    `manifest.json` and a contact sheet per locale.
 *
 * The PPO shots (`PPO` in shots.config.mjs) come out beside the listing, for
 * the App Store slots, under `<locale>/ppo/`.
 *
 * Nothing is uploaded anywhere. See README.md.
 */
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, parse, resolve, sep } from 'node:path'
import { parseArgs } from 'node:util'
import { capture } from './capture.mjs'
import { composeFeatureGraphic, composeLocale, pngInfo } from './compose.mjs'
import {
  FEATURE_GRAPHIC,
  LOCALES,
  ORDER,
  PLAY_LOCALES,
  PLAY_SKIPS,
  PPO,
  SLOTS,
  captionsFor,
} from './shots.config.mjs'
import { REPO, assertPortsFree, exportWeb, serveWeb, startStack } from './stack.mjs'

const { values } = parseArgs({
  options: {
    out: { type: 'string' },
    locales: { type: 'string', default: LOCALES.join(',') },
    'reuse-web': { type: 'boolean', default: false },
    'skip-capture': { type: 'boolean', default: false },
  },
})
if (!values.out) {
  console.error(
    'usage: node tools/store-shots/run.mjs --out <dir> [--locales en,tr] [--reuse-web] [--skip-capture]',
  )
  process.exit(2)
}
/*
 * The run deletes and rewrites under --out (`.work/web` is replaced on every
 * export), so --out must be a directory of its own: not a filesystem root,
 * not the home directory, and outside this repository, which it must never
 * write into.
 */
function outputDir(arg) {
  const dir = resolve(arg)
  const inRepo = dir === REPO || dir.startsWith(REPO + sep) || REPO.startsWith(dir + sep)
  if (dir === parse(dir).root || dir === homedir() || inRepo) {
    throw new Error(`--out ${dir}: pick a directory of its own, outside the repository`)
  }
  return dir
}
const out = outputDir(values.out)
// Only known locales: each one becomes a path segment and a browser flag.
const locales = values.locales
  .split(',')
  .map((l) => l.trim())
  .filter(Boolean)
  .map((l) => {
    const known = LOCALES.find((locale) => locale === l)
    if (!known) throw new Error(`unknown locale ${l}; known: ${LOCALES.join(', ')}`)
    return known
  })
for (const locale of locales) captionsFor(locale) // refuses a half-translated locale before any work
const work = join(out, '.work')
const webDir = join(work, 'web')
mkdirSync(join(work, 'tmp'), { recursive: true })

if (!values['skip-capture']) {
  await assertPortsFree()
  if (!(values['reuse-web'] && existsSync(join(webDir, 'index.html')))) await exportWeb(webDir)
  const web = await serveWeb(webDir)
  try {
    for (const locale of locales) {
      // A fresh world per locale: a capture leaves traces (the call in shot 5
      // ends as a missed-call row in Anna's thread), and every locale has to
      // photograph the same state.
      console.log(`capture ${locale}`)
      const stack = await startStack()
      try {
        await capture({ ...stack, webUrl: web.url }, { locale, outDir: join(work, 'raw', locale) })
      } finally {
        await stack.stop()
      }
    }
  } finally {
    await web.stop()
  }
}

const manifest = {
  generatedAt: new Date().toISOString(),
  order: ORDER,
  ppo: PPO,
  playSkips: PLAY_SKIPS,
  locales: {},
}
for (const locale of locales) {
  console.log(`compose ${locale}`)
  manifest.locales[locale] = await composeLocale({
    locale,
    rawDir: join(work, 'raw', locale),
    outDir: out,
    playLocale: PLAY_LOCALES.includes(locale),
  })
}
await composeFeatureGraphic(out)

// The check: every file its slot's exact size, PNG without alpha, and the
// count each store takes (App Store up to 10 per size, Play up to 8).
const problems = []
const sizes = new Set()
for (const locale of locales) {
  // Each listing slot, then each App Store slot's PPO shots.
  const sets = SLOTS.filter((s) => s.store !== 'play' || PLAY_LOCALES.includes(locale))
    .map((slot) => ({
      slot,
      key: slot.dir,
      want: slot.store === 'play' ? ORDER.length - PLAY_SKIPS.length : ORDER.length,
    }))
    .concat(
      SLOTS.filter((s) => s.store === 'ios').map((slot) => ({
        slot,
        key: `ppo/${slot.dir}`,
        want: PPO.length,
      })),
    )
  for (const { slot, key, want } of sets) {
    const dir = join(out, locale, key)
    const files = readdirSync(dir).filter((f) => f.endsWith('.png'))
    if (files.length !== want)
      problems.push(`${locale}/${key}: ${files.length} files, want ${want}`)
    if (files.length > (slot.store === 'play' ? 8 : 10))
      problems.push(`${locale}/${key}: over the store's limit`)
    for (const f of files) {
      const info = pngInfo(join(dir, f))
      if (info.w !== slot.w || info.h !== slot.h)
        problems.push(`${locale}/${key}/${f}: ${info.w}×${info.h}`)
      if (info.alpha) problems.push(`${locale}/${key}/${f}: has alpha`)
      sizes.add(`${slot.dir} ${info.w}×${info.h}`)
    }
  }
  // One page per locale to look at in full before anything goes up.
  const imgs = sets
    .map(({ slot, key }) => {
      const dir = join(out, locale, key)
      const files = readdirSync(dir)
        .filter((f) => f.endsWith('.png'))
        .sort()
      return `<h2>${key} · ${slot.w}×${slot.h}</h2><div>${files.map((f) => `<img src="${key}/${f}" title="${f}">`).join('')}</div>`
    })
    .join('')
  writeFileSync(
    join(out, locale, 'contact.html'),
    `<!doctype html><meta charset="utf-8"><title>${locale}</title><style>body{font:14px system-ui;background:#ddd;margin:16px}img{height:420px;margin:0 6px 6px 0;box-shadow:0 1px 4px #0003}</style><h1>${locale}</h1>${imgs}`,
  )
}
const fg = pngInfo(join(out, FEATURE_GRAPHIC.file))
if (fg.w !== FEATURE_GRAPHIC.w || fg.h !== FEATURE_GRAPHIC.h || fg.alpha)
  problems.push(`feature graphic: ${fg.w}×${fg.h}${fg.alpha ? ' with alpha' : ''}`)
writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2))
rmSync(join(work, 'tmp'), { recursive: true, force: true })

console.log(`\nsizes: ${[...sizes].sort().join(', ')}, feature graphic ${fg.w}×${fg.h}`)
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log(`all files checked. output: ${out}`)
