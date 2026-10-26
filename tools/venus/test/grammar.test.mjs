// node --test test/*.test.mjs   (from tools/venus/)
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  planDay,
  LOCALES,
  MILESTONES,
  isRoast,
  AXES,
  MOVES,
  REACTION_BY_MOOD,
} from '../grammar.mjs'
import { ENTRANCES, REACTIONS, MOVE_IMPL, PAYOFFS, CAMERAS } from '../lib/score.mjs'
import { LOOKS } from '../lib/layers.mjs'

const DAYS = 400
const BLEP = new Set(['reg-08', 'ro-05', 'ro-20', 'ms-100-b'])

for (const lang of LOCALES) {
  test(`${lang}: neighbours never share a quip, entrance, look or signature move (days 1-${DAYS})`, () => {
    for (let n = 2; n <= DAYS; n++) {
      const a = planDay(n - 1, lang),
        b = planDay(n, lang)
      for (const k of ['entrance', 'look', 'camera', 'reveal', 'payoff'])
        assert.notEqual(a[k], b[k], `day ${n} ${k} = ${b[k]}`)
      assert.notEqual(a.quip.id, b.quip.id, `day ${n} quip`)
      assert.notEqual(a.quip.text, b.quip.text, `day ${n} quip text`)
      if (!b.milestone) assert.notEqual(a.move, b.move, `day ${n} move`)
    }
  })

  test(`${lang}: never two roasts in a row, and roughly 2 warm to 1 sting`, () => {
    let roasts = 0
    for (let n = 1; n <= DAYS; n++) {
      const p = planDay(n, lang)
      if (isRoast(p)) roasts++
      if (n > 1)
        assert.ok(!(isRoast(p) && isRoast(planDay(n - 1, lang))), `days ${n - 1}-${n} both roasts`)
      assert.notEqual(p.quip.pool, 'comeback', 'comeback lines never go into the shared video')
    }
    const share = roasts / DAYS
    assert.ok(share > 0.28 && share < 0.36, `roast share ${share}`)
  })

  test(`${lang}: milestones use their own line; lines are number-free; blep lines at most once a week`, () => {
    let lastBlep = -99
    for (let n = 1; n <= DAYS; n++) {
      const p = planDay(n, lang)
      if (MILESTONES.includes(n)) assert.equal(p.quip.id, `ms-${n}-a`)
      else assert.ok(!p.quip.id.startsWith('ms-'))
      assert.ok(!/\d/.test(p.quip.text), `digit in day ${n}: ${p.quip.text}`)
      if (BLEP.has(p.quip.id)) {
        assert.ok(n - lastBlep >= 7, `blep lines on ${lastBlep} and ${n}`)
        lastBlep = n
      }
    }
  })
}

test('every locale: no line comes back within 30 days', () => {
  for (const lang of LOCALES) {
    const last = new Map()
    for (let n = 1; n <= DAYS; n++) {
      const id = planDay(n, lang).quip.id
      if (last.has(id))
        assert.ok(n - last.get(id) >= 30, `${lang} ${id} on ${last.get(id)} and ${n}`)
      last.set(id, n)
    }
  }
})

// all eight locales hold the full pool, so the schedule never falls back to a short-pool pick and
// every locale says the same line on the same day
test('every locale plays the same line as tr on every day', () => {
  for (const lang of LOCALES)
    for (let n = 1; n <= DAYS; n++)
      assert.equal(planDay(n, lang).quip.id, planDay(n, 'tr').quip.id, `${lang} day ${n}`)
})

test('the plan is deterministic and independent of call order', async () => {
  const a = JSON.stringify(planDay(250, 'de'))
  const fresh = await import('../grammar.mjs?again')
  assert.equal(JSON.stringify(fresh.planDay(250, 'de')), a)
})

test('every option the grammar can pick has an implementation', () => {
  for (const e of AXES.entrance.options) assert.ok(ENTRANCES[e], `entrance ${e}`)
  for (const l of AXES.look.options) assert.ok(LOOKS[l], `look ${l}`)
  for (const c of AXES.camera.options) assert.ok(CAMERAS[c], `camera ${c}`)
  for (const p of AXES.payoff.options) assert.ok(PAYOFFS[p], `payoff ${p}`)
  for (const m of MOVES) assert.ok(MOVE_IMPL[m], `move ${m}`)
  for (const list of Object.values(REACTION_BY_MOOD))
    for (const r of list) assert.ok(REACTIONS[r], `reaction ${r}`)
  for (const lang of LOCALES)
    for (let n = 1; n <= DAYS; n++) {
      const p = planDay(n, lang)
      assert.ok(
        MOVE_IMPL[p.move] && REACTIONS[p.reaction] && ENTRANCES[p.entrance],
        `day ${n} ${lang}`,
      )
    }
})

test('the dolly-out never opens on a walking entrance', () => {
  const walking = new Set(['walk-in', 'strut', 'bag-hop', 'zoomies', 'stretch-up'])
  for (const lang of LOCALES)
    for (let n = 1; n <= DAYS; n++) {
      const p = planDay(n, lang)
      assert.ok(!(p.camera === 'dolly-out' && walking.has(p.entrance)), `day ${n}`)
    }
})
