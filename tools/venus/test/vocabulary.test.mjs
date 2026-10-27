// The v2 acting vocabulary (the character bible, §15): every registered move, reaction and face has an
// implementation, every move hands her back sitting for the payoff, and planDay really picks them
// once a quip names them.
import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { createRequire } from 'node:module'
import { CHARACTER } from '../lib/character.mjs'
import { RIG } from '../lib/paths.mjs'
import { planVideo } from '../lib/intro.mjs'
import { buildScore, EXTRA_EXPR, MOVE_IMPL, REACTIONS } from '../lib/score.mjs'
import * as L from '../lib/layers.mjs'

const req = createRequire(import.meta.url)
const V = req(path.join(RIG, 'venus-rig.js')),
  VA = req(path.join(RIG, 'venus-anim.js'))
Object.assign(V.EXPR, EXTRA_EXPR)
const A = CHARACTER.acting
const V2_MOVES = [
  'knead',
  'hunt-wiggle',
  'knock-off',
  'startle-hop',
  'jump-fail',
  'fall-off',
  'belly-up',
  'big-stretch',
  'egyptian',
  'box-hide',
  'zoomies-dash',
  'groom',
  'sit-on-notes',
  'question-walk',
  'hunker',
  'chatter',
  'tail-notice',
  'carry',
  'sniff',
  'eat',
  'lick-treat',
  'flehmen',
]
const V2_FACES = [
  'saucer',
  'smug-lids',
  'flehmen',
  'averted',
  'guilty',
  'drowsy',
  'chatter',
  'fixated',
  'offended',
  'squeeze',
  'sulk',
  'sob',
  'meant-it',
  'cross-eyed',
]
const OBJECT_ONLY = ['flehmen', 'sulk', 'sob']
// moves that end on a seat: she gives the payoff from the box or the notebook
const SEATED_Y = { 'box-hide': -110, 'sit-on-notes': -16 }
// a voice of two sentences, so the moves that time a beat to the last sentence get one
const VT = {
  words: [],
  sents: [
    { t0: 0.05, t1: 1.15 },
    { t0: 1.55, t1: 2.65 },
  ],
  purr: null,
  whisper: null,
  end: 2.65,
}
const VT1 = { words: [], sents: [{ t0: 0.05, t1: 1.6 }], purr: null, whisper: null, end: 1.6 }

test('every registered move, alt move, reaction and face has an implementation', () => {
  for (const m of A.moves) assert.ok(MOVE_IMPL[m], `move ${m}`)
  for (const [m, alt] of Object.entries(A.altMove)) {
    assert.ok(A.moves.includes(m), `altMove key ${m}`)
    assert.ok(A.moves.includes(alt), `altMove ${m} -> ${alt}`)
    assert.notEqual(m, alt)
  }
  for (const m of A.moves) assert.ok(A.altMove[m], `no altMove for ${m}`)
  for (const [mood, rx] of Object.entries(A.reactionByMood)) {
    for (const r of rx) assert.ok(REACTIONS[r], `${mood}: reaction ${r}`)
    assert.ok(A.musicByMood[mood], `music for ${mood}`)
  }
  for (const [ex, face] of Object.entries(A.faceByExpression))
    assert.ok(V.EXPR[face], `${ex} -> ${face}`)
  for (const m of V2_MOVES) assert.ok(A.moves.includes(m), `${m} not registered`)
  for (const f of V2_FACES) assert.ok(V.EXPR[f], `face ${f}`)
})

test('object-only faces are banned at the viewer and never a line face', () => {
  const lineFaces = new Set(Object.values(A.faceByExpression))
  for (const f of OBJECT_ONLY) {
    assert.ok(A.bannedFacesAtViewer.includes(f), f)
    assert.ok(!lineFaces.has(f), `${f} is a line face`)
  }
})

test('hard rules: no v2 face has airplane ears with an open mouth', () => {
  for (const f of V2_FACES) {
    // airplane ears: turned out sideways (the mock face's rot 26) or folded flat
    const E = V.EXPR[f],
      ears = E.ears || {},
      airplane = ['L', 'R'].some(
        (s) => ((ears[s] || {}).rot || 0) >= 20 || ((ears[s] || {}).fold || 0) > 0.5,
      )
    if (airplane) assert.ok(!((E.mouth || {}).open > 0.1), `${f}: folded ears and an open mouth`)
  }
})

for (const mv of V2_MOVES) {
  test(`${mv}: builds, draws without NaN, and hands her back sitting for the payoff`, () => {
    for (const [vt, day] of [
      [VT, 12],
      [VT1, 3],
    ]) {
      const plan = { ...planVideo(day, 'en', 'first'), move: mv }
      const sc = buildScore(plan, vt)
      for (const e of sc.expr) assert.ok(V.EXPR[e.name], `unknown face ${e.name}`)
      const an = VA.create({
        fps: 30,
        duration: sc.duration,
        base: sc.base,
        expr: sc.expr,
        keys: sc.keys,
        add: sc.add,
        blinks: sc.blinks,
        springs: sc.springs,
        couple: sc.couple,
      })
      const n = Math.round(sc.duration * 30)
      for (let f = 0; f < n; f += 3) {
        const P = an.at(f)
        let s = V.draw(P)
        if (sc.fx.props)
          s +=
            L.moveProps(sc.fx.props, f / 30, P, V, 'back') +
            L.moveProps(sc.fx.props, f / 30, P, V, 'front')
        assert.ok(!/NaN|undefined/.test(s), `frame ${f}`)
      }
      if (sc.cam.lift)
        for (let t = 0; t < sc.duration; t += 0.1)
          assert.ok(Number.isFinite(L.trk(sc.cam.lift, t)), `camera lift at ${t}`)
      const pay = sc.T.e + 0.2 + 0.4,
        P = an.at(Math.round(pay * 30))
      assert.equal(P.mode, 'sit', `mode at the payoff`)
      assert.ok(Math.abs(P.x) < 3, `x ${P.x} at the payoff`)
      assert.ok(Math.abs(P.y - (SEATED_Y[mv] ?? 0)) < 3, `y ${P.y} at the payoff`)
      assert.ok(Math.abs(P.yaw || 0) < 1, `yaw ${P.yaw} at the payoff`)
    }
  })
}

test("planDay picks a new move, its alt move and a new mood's reaction once quips name them", async () => {
  const G = await import('../grammar.mjs?vocabulary-test')
  // two neighbouring non-milestone days get the same new move and mood: the second plays the alt move
  const a = G.planDay(5, 'en'),
    b = G.planDay(6, 'en')
  const fresh = await import('../grammar.mjs?vocabulary-test-2')
  for (const id of [a.quip.id, b.quip.id]) {
    const q = fresh.quipById(id)
    q.move = 'knead'
    q.mood = 'hungry'
    q.expression = 'hungry-stare'
  }
  const p5 = fresh.planDay(5, 'en'),
    p6 = fresh.planDay(6, 'en')
  assert.equal(p5.move, 'knead')
  assert.equal(p6.move, A.altMove.knead)
  assert.ok(A.reactionByMood.hungry.includes(p5.reaction))
  assert.ok(A.reactionByMood.hungry.includes(p6.reaction))
  assert.notEqual(p5.reaction, p6.reaction)
})

// the head outline at a negative turn is the mirror of the same positive turn (it used to fold:
// the mirrored profile runs the other way round, so front point i pairs with profile point n-i)
test('head outline: turning left mirrors turning right, at every angle', () => {
  const outline = (yaw) => {
    const svg = V.draw(V.pose({ head: { yaw } }))
    const d = svg.match(/<clipPath id="[^"]*h"><path d="([^"]+)"/)[1]
    const n = d.match(/-?\d+(\.\d+)?/g).map(Number),
      pts = []
    for (let i = 0; i + 1 < n.length; i += 2) pts.push([n[i], n[i + 1]])
    return pts
  }
  const key = (pts, sx) =>
    pts
      .map(([x, y]) => `${Math.round(sx * x)},${Math.round(y)}`)
      .sort()
      .join(' ')
  for (const a of [5, 12, 24, 40, 60, 85])
    assert.equal(key(outline(-a), -1), key(outline(a), 1), `yaw ±${a}`)
})
