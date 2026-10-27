// The item rules (data/items.json + lib/items.mjs), days 1-400 in every locale.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { planDay, LOCALES, MILESTONES } from '../grammar.mjs'
import {
  REGISTRY,
  ITEMS,
  hasArt,
  IMPLEMENTED,
  planItems,
  itemsFor,
  slotOf,
  applyItemPose,
  itemLayers,
} from '../lib/items.mjs'
import { CHARACTER } from '../lib/character.mjs'
import { inventoryMd, DOC } from '../items-build.mjs'
import { RIG } from '../lib/paths.mjs'

const GEN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DAYS = 400
const KINDS = new Set(['seat', 'floor', 'air', 'head', 'neck', 'rig', 'none'])
const BAGS = new Set(['paper-bag', 'kraft-bag'])
const hasSeat = (p) => p.move === 'bag-throne' || p.entrance === 'bag-hop'

test('registry: every item is well formed', () => {
  const ids = new Set()
  for (const it of REGISTRY.items) {
    assert.ok(!ids.has(it.id), `duplicate ${it.id}`)
    ids.add(it.id)
    assert.ok(REGISTRY.categories[it.category], `${it.id} category ${it.category}`)
    assert.ok(['P0', 'P1', 'P2'].includes(it.priority), `${it.id} priority`)
    assert.ok(KINDS.has(it.kind), `${it.id} kind ${it.kind}`)
    assert.ok(REGISTRY.interactions[it.interaction], `${it.id} interaction ${it.interaction}`)
    for (const k of ['name', 'why', 'beat', 'localeNotes'])
      assert.ok(typeof it[k] === 'string' && it[k].length > 3, `${it.id} ${k}`)
    assert.ok(
      Array.isArray(it.gags) &&
        it.gags.length &&
        Array.isArray(it.formula) &&
        Array.isArray(it.quips),
      `${it.id} gags/formula/quips`,
    )
    for (const f of it.formula) assert.ok(CHARACTER.formulas[f], `${it.id} formula ${f}`)
    assert.ok(Number.isInteger(it.cooldown) && it.cooldown >= 1, `${it.id} cooldown`)
    for (const q of it.quips)
      assert.ok(
        Object.values(JSON.parse(fs.readFileSync(path.join(GEN, 'data/quips.json'), 'utf8')).pools)
          .flat()
          .some((x) => x.id === q),
        `${it.id} quip ${q}`,
      )
  }
  for (const [d, list] of Object.entries(REGISTRY.milestoneSets))
    for (const id of list) assert.ok(ITEMS[id], `milestone ${d}: ${id}`)
})

test('every P0 item has its art and an implemented interaction; every drawn item has its asset file', () => {
  for (const it of REGISTRY.items) {
    if (it.priority === 'P0') {
      assert.ok(hasArt(it), `P0 ${it.id} has no art`)
      assert.ok(
        IMPLEMENTED.has(it.interaction),
        `P0 ${it.id}: interaction ${it.interaction} not implemented`,
      )
    }
    if (it.kind !== 'none') {
      assert.ok(hasArt(it), `${it.id} kind ${it.kind} but no drawing`)
      assert.ok(it.art, `${it.id} has no art path`)
      if (it.kind !== 'rig')
        assert.ok(
          fs.existsSync(path.join(GEN, it.art)),
          `${it.art} missing (node items-build.mjs --assets)`,
        )
    } else assert.ok(!it.art, `${it.id} is not drawn but names art`)
  }
})

test('inventory.md is generated from the registry (node items-build.mjs --doc)', () => {
  assert.equal(fs.readFileSync(DOC, 'utf8'), inventoryMd() + '\n')
})

test('the registry agrees with data/character.json', () => {
  assert.deepEqual(
    Object.keys(REGISTRY.milestoneSets)
      .map(Number)
      .sort((a, b) => a - b),
    CHARACTER.milestones.days,
  )
  for (const [q, outfit] of Object.entries(CHARACTER.lines.outfits))
    assert.ok(ITEMS[outfit].quips.includes(q), `${outfit} should list ${q}`)
  for (const it of REGISTRY.items.filter((i) => i.kind === 'rig'))
    for (const q of it.quips) assert.equal(CHARACTER.lines.outfits[q], it.id, `${it.id} lists ${q}`)
})

// The character bible is kept outside the repo, with the private reference material it was
// written from. With VENUS_BIBLE pointing at it, the gag ids are checked against it too.
test(
  "gag ids name the bible's running gags and habits",
  { skip: !process.env.VENUS_BIBLE && 'set VENUS_BIBLE to the bible to run it' },
  () => {
    const bible = fs.readFileSync(process.env.VENUS_BIBLE, 'utf8').toLowerCase().replace(/-/g, ' ')
    for (const it of REGISTRY.items)
      for (const g of it.gags)
        assert.ok(bible.includes(g.replace(/-/g, ' ')), `${it.id}: gag ${g} not in the bible`)
  },
)

for (const lang of LOCALES) {
  test(`${lang}: item grammar rules hold, days 1-${DAYS}`, () => {
    let rest = 0,
      ordinary = 0
    for (let n = 1; n <= DAYS; n++) {
      const p = planDay(n, lang),
        I = planItems(n, lang),
        ms = MILESTONES.includes(n)
      // rig outfits are the quip's own words (grammar.mjs puts them on), so two onesie lines on
      // neighbouring days keep it on: a callback, not a repeat the item grammar chose
      if (n > 1) {
        const y = planItems(n - 1, lang)
        for (const id of I.ids)
          if (ITEMS[id].kind !== 'rig')
            assert.ok(!y.ids.includes(id), `${lang} day ${n}: ${id} two days running`)
      }
      for (const id of I.ids) {
        const it = ITEMS[id]
        assert.ok(
          it && (it.kind === 'rig' || hasArt(it)),
          `${lang} day ${n}: ${id} is not drawable`,
        )
        if (it.milestoneOnly) assert.ok(ms, `${lang} day ${n}: milestone-only ${id}`)
        assert.ok(!it.seasonalOnly, `${lang} day ${n}: seasonal ${id}`)
      }
      // one item per slot, and the slot fields agree with ids
      for (const slot of ['seat', 'wear', 'neck', 'prop', 'air'])
        if (I[slot]) assert.equal(slotOf(ITEMS[I[slot]]), slot)
      // the throne exactly when the score builds it; bag lines get a bag
      assert.equal(
        !!I.seat && I.seatMode === 'bag',
        hasSeat(p),
        `${lang} day ${n}: seat ${I.seat} vs plan`,
      )
      if (I.seat && I.seatMode === 'bag' && ITEMS['paper-bag'].quips.includes(p.quip.id))
        assert.ok(BAGS.has(I.seat), `${lang} day ${n}: bag line on ${I.seat}`)
      if (p.outfit) assert.ok(!I.neck, `${lang} day ${n}: neck wear over the ${p.outfit}`)
      if (I.air === 'feather-wand')
        assert.ok(
          p.reaction !== 'diva-flick' && p.move !== 'sprawl-paw',
          `${lang} day ${n}: the paw is busy`,
        )
      if (I.prop && ITEMS[I.prop].glyphs)
        assert.equal(I.side, -1, `${lang} day ${n}: glyphs in the right rail`)
      if (ms)
        for (const id of REGISTRY.milestoneSets[String(n)]) {
          const it = ITEMS[id]
          if (it.kind === 'seat' && I.seat && I.seat !== id) continue // the score's throne wins
          assert.ok(I.ids.includes(id), `${lang} milestone ${n} lacks ${id}`)
        }
      if (!ms && !I.seat) {
        ordinary++
        if (!I.ids.filter((id) => ITEMS[id].kind !== 'rig').length) rest++
      }
    }
    const share = rest / ordinary
    assert.ok(share > 0.15 && share < 0.5, `${lang} item-free share ${share}`)
  })

  test(`${lang}: picked items respect their cooldown`, () => {
    const last = new Map()
    for (let n = 1; n <= DAYS; n++) {
      const p = planDay(n, lang),
        I = planItems(n, lang)
      for (const id of I.ids) {
        const it = ITEMS[id]
        const called =
          it.quips.includes(p.quip.id) ||
          MILESTONES.includes(n) ||
          it.kind === 'seat' ||
          it.kind === 'rig'
        if (!called && last.has(id))
          assert.ok(n - last.get(id) >= it.cooldown, `${lang} ${id} on ${last.get(id)} and ${n}`)
        last.set(id, n)
      }
    }
  })
}

test('items are deterministic per (day, locale) and independent of call order', async () => {
  const a = JSON.stringify(planItems(250, 'ru'))
  const fresh = await import('../lib/items.mjs?again')
  assert.equal(JSON.stringify(fresh.planItems(250, 'ru')), a)
})

test('a seat is drawn round her: back before the figure, front wall after it, no plastic bag', () => {
  const V = createRequire(import.meta.url)(path.join(RIG, 'venus-rig.js'))
  // the first ordinary throne day (which day that is follows the quip schedule)
  const n = Array.from({ length: 60 }, (_, i) => i + 2).find(
    (d) => !MILESTONES.includes(d) && itemsFor({ ...planDay(d, 'tr') }).seat,
  )
  const IT = itemsFor({ ...planDay(n, 'tr') })
  assert.ok(IT.seat, `day ${n} is a throne day`)
  const P = V.pose({ expr: 'proud', bag: 1 })
  const sc = { R: 2, T: { v: 3, e: 6, sents: [{ t0: 3, t1: 6 }] }, endAt: 9, blink: 7 }
  applyItemPose(IT, 4, P, sc)
  assert.equal(P.bag, 0, 'the rig bag is off')
  const fig = V.draw(P),
    out = itemLayers(IT, 4, P, fig, sc)
  const at = out.indexOf(fig)
  assert.ok(at > 0, 'the figure sits inside the seat layers')
  assert.ok(out.length - (at + fig.length) > 200, 'the seat front is drawn over her')
  assert.ok(!out.includes('#FFCF1F'), 'no plastic bag')
})

test('head wear follows the head: spliced inside the rig figure after the head group', () => {
  const V = createRequire(import.meta.url)(path.join(RIG, 'venus-rig.js'))
  const IT = {
    day: 7,
    lang: 'tr',
    ids: ['sunglasses'],
    seat: null,
    wear: 'sunglasses',
    neck: 'scarf',
    prop: null,
    air: null,
    side: 1,
  }
  const P = V.pose({ expr: 'smug' })
  const sc = { R: 0, T: { v: 3, e: 6, sents: [{ t0: 3, t1: 6 }] }, endAt: 9, blink: 7 }
  const fig = V.draw(P),
    out = itemLayers(IT, 4, P, fig, sc)
  assert.ok(out.endsWith('</g>') && out.length > fig.length + 500)
  assert.ok(
    out.indexOf('translate(0 -80)') < out.lastIndexOf('#262A3A'),
    'the lenses come after the head',
  )
})

test('the cat-things canon (character.json catThings, bible §13) agrees with the food registry', () => {
  const C = CHARACTER.catThings,
    F = C.food
  for (const id of [
    F.favouriteFish,
    F.topReward,
    ...F.likes,
    ...F.steals,
    ...F.ignores,
    ...Object.keys(F.rituals),
  ])
    assert.equal(ITEMS[id]?.category, 'food', `${id} is not a food item`)
  const used = new Set(REGISTRY.items.filter((i) => i.category === 'food').flatMap((i) => i.gags))
  for (const g of C.gags) assert.ok(used.has(g), `cat-things gag ${g} is on no food item`)
  // food is in rotation since the 100-day run (v5, 25 Oct, owner's go): every food item can be picked
  for (const it of REGISTRY.items.filter((i) => i.category === 'food'))
    assert.notEqual(it.pickable, false, `${it.id} is not pickable`)
})
