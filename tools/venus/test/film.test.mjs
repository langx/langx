// node --test test/*.test.mjs   (from tools/venus/)  — the introduction film's clock, lines and shots
// (lib/film-clock.mjs, data/film-intro.json, lib/film-shots.mjs). No browser: film.mjs is not
// imported, the shots are performed without drawing a frame.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import {
  FILM,
  LOCALES,
  CLOCK,
  GRID,
  inGrid,
  buildClock,
  captionTimes,
  readChars,
} from '../lib/film-clock.mjs'
import {
  SHOTS,
  END_BOARD,
  placeShots,
  shotClock,
  performShot,
  flashesAndCuts,
} from '../lib/film-shots.mjs'
import { END_LEN } from '../lib/endcard.mjs'
import { EXTRA_EXPR } from '../lib/score.mjs'
import { RIG } from '../lib/paths.mjs'
import { CHARACTER } from '../lib/character.mjs'
import { sentences } from '../lib/voice.mjs'
import { lintIntroLines } from '../lint-quips.mjs'

const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps
const isBeat = (x) => near(x / CLOCK.beat, Math.round(x / CLOCK.beat), 1e-6)
const leading = (s) => /^…/u.test(s.text)

// one locale, performed: every shot placed on its clock, her shots with their animators
function perform(lang) {
  const clock = buildClock(lang)
  const shots = placeShots(clock, lang)
  for (const sh of shots) {
    if (sh.day || sh.wall) continue
    const S = shotClock(sh, clock)
    // film.mjs measures the bonk's height in the browser; any height performs the same faces
    if (sh.id === 'bonk') S.top = 200
    Object.assign(sh, performShot(sh, S))
  }
  return { clock, shots }
}
const performed = new Map(LOCALES.map((l) => [l, perform(l)]))

test('the board: the English silent clock reproduces it, and the film is 96.6 s', () => {
  const C = buildClock('en')
  assert.deepEqual(C.pushes, [])
  for (const L of FILM.lines)
    L.at.forEach(([a, b], i) => {
      const s = C.lines[L.id].sents[i]
      assert.equal(s.t0, a, `${L.id}[${i}] starts on the board`)
      assert.ok(Math.abs(s.t1 - b) <= 0.015, `${L.id}[${i}] ends ${s.t1}, the board says ${b}`)
    })
  assert.equal(C.W(96.6), 96.6)
  const shots = placeShots(C)
  assert.equal(shots[shots.length - 1].T1, +(END_BOARD + END_LEN).toFixed(3))
  assert.equal(shots[shots.length - 1].T1, 96.6)
})

test('the board: sentences are in order, never overlap, and fit their modes', () => {
  let last = -1
  for (const L of FILM.lines) {
    assert.equal(L.modes.length, L.at.length, L.id)
    for (const m of L.modes) assert.ok(['on', 'vo', 'whisper'].includes(m), `${L.id}: ${m}`)
    for (const [a, b] of L.at) {
      assert.ok(a >= last - 1e-9 && b > a, `${L.id}: ${a}..${b} after ${last}`)
      last = b
    }
  }
  assert.ok(last < END_BOARD, 'every line is said before the end card')
  // the shots tile the board in order
  for (let i = 1; i < SHOTS.length; i++) assert.ok(SHOTS[i].from > SHOTS[i - 1].from, SHOTS[i].id)
})

test('lines: every locale keeps the sentences and every "…" where the beats expect them', () => {
  for (const L of FILM.lines) {
    const en = sentences(L.text.en)
    for (const lang of LOCALES) {
      const text = L.text[lang]
      assert.ok(text, `${L.id} ${lang} missing`)
      assert.ok(!/\d/.test(text), `${L.id} ${lang} has a digit`)
      const ss = sentences(text)
      assert.equal(ss.length, L.at.length, `${L.id} ${lang}: ${ss.map((s) => s.text).join(' | ')}`)
      ss.forEach((s, i) =>
        assert.equal(leading(s), leading(en[i]), `${L.id} ${lang} sentence ${i + 1}: "${s.text}"`),
      )
    }
    // a line short enough to read at the board's pace
    assert.ok(L.text.en.split(/\s+/).length <= 12, `${L.id}: ${L.text.en}`)
  }
  for (const [k, by] of Object.entries(FILM.screen))
    for (const lang of LOCALES) assert.ok(by[lang] && !/\d/.test(by[lang]), `screen.${k} ${lang}`)
})

test('lines: every locale passes the character lint', () => {
  assert.deepEqual(lintIntroLines(FILM.lines), [])
  assert.deepEqual(
    lintIntroLines(Object.entries(FILM.screen).map(([id, text]) => ({ id, text }))),
    [],
  )
})

test('the warp: a longer locale pushes whole beats inside the grid, and never runs faster', () => {
  for (const lang of LOCALES) {
    const C = buildClock(lang)
    for (const [b, p] of C.pushes) {
      const L = FILM.lines.find((x) => x.at.some(([, e]) => e === b))
      const a = L.at.find(([, e]) => e === b)[0]
      if (inGrid(a)) assert.ok(isBeat(p), `${lang} ${L.id}: push ${p} at ${b}`)
    }
    // every cut inside a 120 bpm section keeps its place on the section's beat grid
    for (const [g0, g1] of GRID)
      for (const sh of SHOTS)
        if (sh.from > g0 && sh.from < g1) {
          const drift = C.W(sh.from) - C.W(g0) - (sh.from - g0)
          assert.ok(drift >= -1e-6 && isBeat(drift), `${lang} ${sh.id}: drifts ${drift}`)
        }
    // monotone, and never earlier than the board
    let prev = -1
    for (let t = 0; t <= 96.6; t += 0.05) {
      const w = C.W(t)
      assert.ok(w >= t - 1e-6 && w >= prev, `${lang}: W(${t}) = ${w}`)
      prev = w
    }
  }
})

test('the warp: voice takes re-time the film, sentence by sentence', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'venus-film-'))
  try {
    // intro-03 voiced slower than the board: 3 s for its first sentence (board 2.07 s), a gap,
    // then 1 s for "…I made a film."
    const L = FILM.lines.find((x) => x.id === 'intro-03')
    const text = L.text.en
    const [s1, s2] = sentences(text)
    const st = [],
      en = []
    for (let i = 0; i < text.length; i++) {
      // sentence one over 0.2..3.2, the space between over 3.2..3.6, sentence two over 3.6..4.6
      const [a, b, t0, t1] =
        i < s1.b
          ? [s1.a, s1.b, 0.2, 3.2]
          : i < s2.a
            ? [s1.b, s2.a, 3.2, 3.6]
            : [s2.a, s2.b, 3.6, 4.6]
      const u0 = t0 + ((t1 - t0) * (i - a)) / (b - a),
        u1 = t0 + ((t1 - t0) * (i + 1 - a)) / (b - a)
      st.push(+u0.toFixed(3))
      en.push(+u1.toFixed(3))
    }
    fs.mkdirSync(path.join(dir, 'en'))
    fs.writeFileSync(path.join(dir, 'en', 'intro-03.wav'), '')
    fs.writeFileSync(
      path.join(dir, 'en', 'intro-03.json'),
      JSON.stringify({
        alignment: {
          characters: [...text],
          character_start_times_seconds: st,
          character_end_times_seconds: en,
        },
      }),
    )
    const silent = buildClock('en'),
      C = buildClock('en', { voiceDir: dir })
    const take = C.lines['intro-03']
    assert.ok(take.take, 'the take is read')
    assert.equal(s1.text.length > 0 && take.sents.length, 2)
    // the first sentence lasts as long as it is said, the second starts the board's gap later
    const [b1, b2] = L.at
    assert.ok(near(take.sents[0].t0, b1[0], 1e-3))
    assert.ok(near(take.sents[0].t1 - take.sents[0].t0, 3.0, 0.01))
    const push = 3.0 - (b1[1] - b1[0])
    assert.ok(near(take.sents[1].t0, b2[0] + push, 0.01), `${take.sents[1].t0}`)
    // outside the grid the push is exact; the title (10.6, a grid start) moves by it too
    assert.ok(near(C.W(10.6) - silent.W(10.6), push, 0.01))
    // the take is cut at each sentence's first spoken letter (past the "…") and placed where it starts
    assert.equal(take.sents[1].take.at, take.sents[1].t0)
    assert.equal(take.sents[1].take.from, st[s2.a + 1])
    // words follow the alignment
    assert.ok(near(take.sents[0].words[0].t0, b1[0], 0.01))
    // a take whose characters are not the line is refused
    fs.writeFileSync(
      path.join(dir, 'en', 'intro-03.json'),
      JSON.stringify({
        characters: ['x'],
        character_start_times_seconds: [0],
        character_end_times_seconds: [1],
      }),
    )
    assert.throws(() => buildClock('en', { voiceDir: dir }), /not the line's text/)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('captions: one bubble at a time, never clearing just before or after a cut', () => {
  for (const lang of LOCALES) {
    const { clock, shots } = performed.get(lang)
    const { cuts } = flashesAndCuts(shots)
    const order = captionTimes(clock, cuts)
    for (let k = 0; k < order.length; k++) {
      const L = order[k],
        N = order[k + 1]
      assert.ok(L.hide > L.show, `${lang} ${L.id}`)
      assert.ok(
        L.show <= L.sents[0].t0 && L.hide >= L.sents[L.sents.length - 1].t1,
        `${lang} ${L.id}`,
      )
      for (const c of cuts)
        assert.ok(
          near(L.hide, c, 1e-3) ||
            Math.abs(L.hide - c) >= CLOCK.cutGuard - 1e-3 ||
            (N && N.swapIn && near(N.show, L.hide)),
          `${lang} ${L.id}: clears at ${L.hide}, a cut at ${c}`,
        )
      if (N) {
        assert.ok(N.show >= L.hide - 1e-6, `${lang}: ${L.id} still up when ${N.id} opens`)
        if (N.swapIn) assert.equal(N.show, L.hide, `${lang} ${N.id} swaps in`)
      }
      // a bubble stays up long enough to read
      assert.ok(L.hide - L.show >= Math.min(1.2, readChars(L.text) / 15), `${lang} ${L.id}`)
    }
  }
})

test('photosensitivity: flashes at least 0.5 s apart, at most 3 flashes or cuts in any second', () => {
  for (const lang of LOCALES) {
    const { shots } = performed.get(lang)
    const { flashes, cuts } = flashesAndCuts(shots)
    assert.ok(flashes.length > 0, `${lang}: the booth flashes`)
    for (let i = 1; i < flashes.length; i++)
      assert.ok(
        flashes[i] - flashes[i - 1] >= 0.5 - 1e-6,
        `${lang}: ${flashes[i - 1]}, ${flashes[i]}`,
      )
    const events = [...flashes, ...cuts].sort((a, b) => a - b)
    for (const t of events) {
      const n = events.filter((x) => x >= t - 1e-6 && x < t + 1 - 1e-6).length
      assert.ok(n <= 3, `${lang}: ${n} flashes or cuts in [${t}, ${t + 1})`)
    }
  }
})

test('faces: every face she makes exists, and none is one she never aims at the viewer', () => {
  const V = createRequire(import.meta.url)(path.join(RIG, 'venus-rig.js'))
  const faces = new Set([...Object.keys(V.EXPR), ...Object.keys(EXTRA_EXPR)])
  const banned = new Set([...CHARACTER.acting.bannedFacesAtViewer, 'loving'])
  for (const lang of LOCALES)
    for (const sh of performed.get(lang).shots) {
      if (!sh.c) continue
      for (const e of sh.c.ex) {
        assert.ok(faces.has(e.name), `${lang} ${sh.id}: unknown face ${e.name}`)
        assert.ok(!banned.has(e.name), `${lang} ${sh.id}: ${e.name}`)
      }
    }
})

test('shots: every one of hers performs in every locale, inside its own length', () => {
  for (const lang of LOCALES) {
    const { shots } = performed.get(lang)
    assert.equal(shots.length, SHOTS.length)
    for (let i = 1; i < shots.length; i++)
      assert.ok(shots[i].T0 > shots[i - 1].T0 && near(shots[i - 1].T1, shots[i].T0), shots[i].id)
    for (const sh of shots) {
      if (sh.day || sh.wall || sh.empty) continue
      assert.ok(sh.anim, `${lang} ${sh.id}`)
      // the animator steps forward through the whole shot without throwing
      for (let f = 0; f < Math.round((sh.T1 - sh.T0 + sh.off) * 30); f += 15) sh.anim.at(f)
    }
  }
})
