// Lints data/quips-food-draft.json with the same text rules as lint-quips.mjs (checkText), plus
// the per-quip structure checks that apply to a draft: length caps (en 12 words, tr about 10),
// at most two beats, no exclamation, a known move / face / mood, a safe target on every tease,
// and an existing food item.
import fs from 'node:fs'
import { checkText, compileRules } from './lint-quips.mjs'
import { CHARACTER } from './lib/character.mjs'
import { ITEMS } from './lib/items.mjs'
const D = JSON.parse(fs.readFileSync(new URL('./data/quips-food-draft.json', import.meta.url)))
const rules = compileRules(),
  A = CHARACTER.acting,
  errs = []
const all = Object.entries(D.pools).flatMap(([pool, l]) => l.map((q) => ({ ...q, pool })))
const ids = new Set()
for (const q of all) {
  if (ids.has(q.id)) errs.push(`${q.id}: duplicate`)
  ids.add(q.id)
  for (const [loc, t] of Object.entries(q.text)) {
    for (const h of checkText(t, loc, { target: q.target ?? null, rules }))
      errs.push(`${q.id} ${loc} ${h.category} /${h.pattern}/`)
    const w = t.split(/\s+/).length,
      max = { en: 12, tr: 10 }[loc]
    if (w > max) errs.push(`${q.id} ${loc}: ${w} words > ${max}`)
    if ((t.match(/…/g) || []).length > 2) errs.push(`${q.id} ${loc}: more than two beats`)
    if (t.includes('!')) errs.push(`${q.id} ${loc}: exclamation outside a milestone`)
  }
  if (!A.moves.includes(q.move)) errs.push(`${q.id}: move ${q.move}`)
  if (!A.faceByExpression[q.expression]) errs.push(`${q.id}: expression ${q.expression}`)
  if (!A.reactionByMood[q.mood]) errs.push(`${q.id}: mood ${q.mood}`)
  if (
    CHARACTER.schedule.stingPools.includes(q.pool) &&
    !CHARACTER.teases.targets.includes(q.target)
  )
    errs.push(`${q.id}: tease without a safe target`)
  if (q.item && ITEMS[q.item]?.category !== 'food') errs.push(`${q.id}: item ${q.item}`)
}
const teases = all.filter((q) => q.pool === 'roast')
const share = (t) => (teases.filter((q) => q.target === t).length / teases.length).toFixed(2)
if (errs.length) {
  console.error(errs.join('\n'))
  process.exit(1)
}
console.log(
  `ok: ${all.length} draft quips (${Object.entries(D.pools)
    .map(([p, l]) => `${p} ${l.length}`)
    .join(', ')}); teases self ${share('self')}, habit ${share('habit')}`,
)
