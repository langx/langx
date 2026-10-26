// The character lint: every quip, every locale, against data/character.json.
//   node lint-quips.mjs            exits 1 and lists every problem, or prints a summary
//   import { lintQuips } from './lint-quips.mjs'   -> { errors: [...], stats }
//
// The CLI also checks the day-1 intro and return lines (lib/intro.mjs) with the same text rules.
//
// What it rejects (data/character.json -> lint.categories): numbers, guilt, surveillance ("I'm
// watching"), time-of-day or weekday assumptions, innuendo, digs at the viewer's effort, ability,
// body or accent, effort words in a tease aimed at the viewer, and selling. It also enforces the
// structure: the warm-to-sting ratio of the schedule, at least half of the teases landing on
// herself, a safe target on every tease, the English length cap, a line for every milestone, and
// no comeback pool in the story schedule.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CHARACTER } from './lib/character.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const QUIPS_FILE = path.join(HERE, 'data/quips.json')

// category -> locale -> [RegExp]; 'all' is merged into every locale
export function compileRules(character = CHARACTER) {
  const out = {}
  for (const [cat, def] of Object.entries(character.lint.categories)) {
    out[cat] = { why: def.why, scope: def.scope ?? 'line', byLocale: {} }
    for (const [k, list] of Object.entries(def)) {
      if (['why', 'scope'].includes(k)) continue
      out[cat].byLocale[k] = list.map((s) => new RegExp(s, 'iu'))
    }
  }
  return out
}

// one text against the rules; returns [{ category, pattern }]
export function checkText(text, locale, { target = null, rules = compileRules() } = {}) {
  const hits = []
  for (const [cat, r] of Object.entries(rules)) {
    if (r.scope === 'habit' && target !== 'habit') continue
    for (const re of [...(r.byLocale.all ?? []), ...(r.byLocale[locale] ?? [])])
      if (re.test(text)) hits.push({ category: cat, pattern: re.source })
  }
  return hits
}

export function lintQuips(quips, character = CHARACTER) {
  const rules = compileRules(character)
  const errors = []
  const err = (id, msg) => errors.push(`${id}: ${msg}`)
  const all = Object.entries(quips.pools).flatMap(([pool, list]) =>
    list.map((q) => ({ ...q, pool })),
  )

  // 1. every text in every locale. lint.allow names the few lines the owner signed off with a rule
  // knowingly broken (ms-7-a counts the days out loud: the count is its joke)
  for (const q of all) {
    const allowed = new Set(character.lint.allow?.[q.id]?.categories ?? [])
    for (const [loc, text] of Object.entries(q.text)) {
      for (const h of checkText(text, loc, { target: q.target ?? null, rules }))
        if (!allowed.has(h.category)) err(q.id, `${loc} ${h.category} /${h.pattern}/ in "${text}"`)
      const max = character.lines.maxWords[loc]
      if (max && text.split(/\s+/).length > max)
        err(q.id, `${loc} has ${text.split(/\s+/).length} words (max ${max})`)
    }
  }

  // 2. teases: a safe target each, and the self / habit shares
  const T = character.teases
  const teases = all.filter((q) => character.schedule.stingPools.includes(q.pool))
  for (const q of teases)
    if (!T.targets.includes(q.target))
      err(q.id, `tease target "${q.target}" is not one of ${T.targets.join(', ')}`)
  const share = (t) =>
    teases.length ? teases.filter((q) => q.target === t).length / teases.length : 0
  for (const [t, min] of Object.entries(T.minShare))
    if (share(t) < min) err('teases', `${t} share ${share(t).toFixed(2)} < ${min}`)
  for (const [t, max] of Object.entries(T.maxShare))
    if (share(t) > max) err('teases', `${t} share ${share(t).toFixed(2)} > ${max}`)
  for (const q of all)
    if (q.target && !character.schedule.stingPools.includes(q.pool))
      err(q.id, 'only teases carry a target')

  // 3. the schedule: warm to sting, no stings back to back (the pattern wraps), no comeback pool
  const S = character.schedule
  const pat = quips.schedule?.pattern ?? []
  if (JSON.stringify(pat) !== JSON.stringify(S.pattern))
    err(
      'schedule',
      `quips.json pattern ${JSON.stringify(pat)} differs from character.json ${JSON.stringify(S.pattern)}`,
    )
  const sting = pat.filter((p) => S.stingPools.includes(p)).length
  const warm = pat.filter((p) => S.warmPools.includes(p)).length
  if (!sting || warm / sting < S.warmToSting)
    err('schedule', `warm:sting is ${warm}:${sting}, needs at least ${S.warmToSting}:1`)
  pat.forEach((p, i) => {
    if (S.stingPools.includes(p) && S.stingPools.includes(pat[(i + 1) % pat.length]))
      err('schedule', `two stings in a row at slot ${i + 1}`)
  })
  for (const p of pat)
    if (S.neverInStory.includes(p)) err('schedule', `${p} is never in the story video`)
  for (const p of pat) if (!quips.pools[p]?.length) err('schedule', `pool ${p} is empty`)

  // 4. milestones: a line for each, in every locale the library renders
  const locales = Object.keys(quips.counts ?? {})
  for (const d of character.milestones.days) {
    const q = all.find((x) => x.id === `ms-${d}-a`)
    if (!q) {
      err(`ms-${d}-a`, 'missing')
      continue
    }
    for (const l of locales) if (!q.text[l]) err(q.id, `no ${l} text`)
  }

  // 5. acting data the quips point at
  const A = character.acting
  for (const q of all) {
    if (!A.moves.includes(q.move)) err(q.id, `move "${q.move}" is not in acting.moves`)
    if (!A.faceByExpression[q.expression]) err(q.id, `expression "${q.expression}" has no face`)
    if (A.bannedFacesAtViewer.includes(A.faceByExpression[q.expression]))
      err(q.id, `face "${A.faceByExpression[q.expression]}" is never aimed at the viewer`)
  }

  const stats = {
    quips: all.length,
    texts: all.reduce((n, q) => n + Object.keys(q.text).length, 0),
    teases: teases.length,
    selfShare: +share('self').toFixed(2),
    habitShare: +share('habit').toFixed(2),
    warm,
    sting,
  }
  return { errors, stats }
}

// the day-1 intro and return lines live in lib/intro.mjs, not quips.json; they get the same text rules
export function lintIntroLines(lines) {
  const rules = compileRules()
  const errors = []
  for (const L of Object.values(lines))
    for (const [loc, text] of Object.entries(L.text))
      for (const h of checkText(text, loc, { rules }))
        errors.push(`${L.id}: ${loc} ${h.category} /${h.pattern}/ in "${text}"`)
  return errors
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = process.argv[2] ? path.resolve(process.argv[2]) : QUIPS_FILE
  const { errors, stats } = lintQuips(JSON.parse(fs.readFileSync(file, 'utf8')))
  // the intro module pulls in the score, so it is only loaded by the CLI
  if (!process.argv[2]) errors.push(...lintIntroLines((await import('./lib/intro.mjs')).LINES))
  if (errors.length) {
    console.error(errors.join('\n'))
    console.error(`\n${errors.length} problem(s) in ${file}`)
    process.exit(1)
  }
  console.log(
    `ok: ${stats.quips} quips, ${stats.texts} texts; teases ${stats.teases} (self ${stats.selfShare}, habit ${stats.habitShare}); warm:sting ${stats.warm}:${stats.sting}`,
  )
}
