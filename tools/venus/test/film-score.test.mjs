// node --test test/*.test.mjs   (from tools/venus/)  — the introduction film's score and its place in
// the mix (lib/film-score.mjs). Pure: the plan is checked note by note, nothing is rendered.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { FILM, LOCALES, buildClock } from '../lib/film-clock.mjs'
import { END_BOARD, placeShots } from '../lib/film-shots.mjs'
import {
  BPM,
  BAR,
  KEY,
  SCALE,
  PROG,
  MOTIF,
  BED,
  chordOf,
  envAt,
  planScore,
  bedGain,
  bedLower,
} from '../lib/film-score.mjs'
import { SR } from '../lib/synth/dsp.mjs'
import { sentences } from '../lib/voice.mjs'

const plan = (clock) =>
  planScore(clock, {
    endAt: clock.W(END_BOARD),
    duration: placeShots(clock).at(-1).T1,
  })
// the layers that only make noise: they may step in on a downbeat; everything pitched ramps, except
// on the title slam (bar 0), where the whole band lands at once after the riser
const DRUMS = new Set(['shaker0', 'house', 'hats16', 'half'])
// where a bar position sits on a bar line
const onBar = (u) => Math.abs(u - Math.round(u)) < 1e-9

// Every locale's silent clock, and English voiced three ways: every sentence of every line said
// `over` seconds slower than the board (takes written the way ElevenLabs aligns them)
function voicedClocks() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'venus-score-'))
  const out = []
  try {
    for (const over of [0.13, 0.37, 0.61]) {
      const d = path.join(dir, String(over), 'en')
      fs.mkdirSync(d, { recursive: true })
      for (const L of FILM.lines) {
        const text = L.text.en,
          st = new Array(text.length).fill(0),
          en = new Array(text.length).fill(0)
        let u = 0.1
        sentences(text).forEach((p, i) => {
          const len = L.at[i][1] - L.at[i][0] + over
          for (let k = p.a; k < p.b; k++) {
            st[k] = +(u + (len * (k - p.a)) / (p.b - p.a)).toFixed(3)
            en[k] = +(u + (len * (k + 1 - p.a)) / (p.b - p.a)).toFixed(3)
          }
          for (let k = p.b; k < text.length; k++) st[k] = en[k] = en[p.b - 1]
          u += len + 0.2
        })
        fs.writeFileSync(path.join(d, `${L.id}.wav`), '')
        fs.writeFileSync(
          path.join(d, `${L.id}.json`),
          JSON.stringify({
            alignment: {
              characters: [...text],
              character_start_times_seconds: st,
              character_end_times_seconds: en,
            },
          }),
        )
      }
      out.push([`en +${over}`, buildClock('en', { voiceDir: path.join(dir, String(over)) })])
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
  return out
}
const clocks = [...LOCALES.map((l) => [l, buildClock(l)]), ...voicedClocks()]
const plans = clocks.map(([name, clock]) => [name, clock, plan(clock)])

test('score: G major, the roots G D E C, 120 bpm, every bar 2 s to the sample', () => {
  assert.equal(BPM, 120)
  assert.equal(BAR, 2)
  assert.deepEqual(
    PROG.map(([d]) => (KEY + d) % 12),
    [7, 2, 4, 0],
  )
  for (const [name, , P] of plans) {
    for (const e of P.events)
      if (e.m !== undefined) assert.ok(SCALE.includes(e.m % 12), `${name} ${e.layer} ${e.m}`)
    for (const [b, root] of P.chords) assert.ok([7, 2, 4, 0].includes(root), `${name} bar ${b}`)
    // the bar lines: every kick on a beat one lands on bar0 + 2b, to the sample, and every bar of
    // the groove has one
    const ones = P.events
      .filter((x) => x.i === 'kick' || x.i === 'kickSoft')
      .filter((e) => Math.abs((e.t - P.bar0) / BAR - Math.round((e.t - P.bar0) / BAR)) < 1e-3)
    for (const e of ones) {
      const b = Math.round((e.t - P.bar0) / BAR)
      assert.ok(Math.abs(e.t - (P.bar0 + b * BAR)) <= 1 / SR, `${name} ${e.t}`)
    }
    assert.ok(ones.length >= P.sections[4].to - P.sections[1].from - 2, `${name}: ${ones.length}`)
    // the end: IV in the bar before the end card's first bar line, I held from it
    assert.deepEqual(chordOf(P, P.end - 1), [0, 'maj7'])
    assert.deepEqual(chordOf(P, P.end), [KEY, 'maj'])
  }
})

test('score: at most six sections, every change on a bar line, every ramp a bar or more', () => {
  for (const [name, , P] of plans) {
    assert.ok(P.sections.length <= 6, name)
    P.sections.forEach((s, k) => {
      assert.ok(Number.isInteger(s.from) && Number.isInteger(s.to) && s.to > s.from, name)
      if (k) assert.equal(s.from, P.sections[k - 1].to, `${name} ${s.id}`)
      // no section so short it reads as a sting
      if (k && k < P.sections.length - 1) assert.ok(s.to - s.from >= 4, `${name} ${s.id}`)
    })
    for (const [a, b] of P.ramps) assert.ok(b - a >= 1 && onBar(a) && onBar(b), `${name}`)
    for (const [layer, keys] of Object.entries(P.env))
      keys.forEach(([u, g], i) => {
        // the pad's first fade starts on the film's first frame, wherever the bar line is
        if (layer === 'pad' && i < 2) return
        assert.ok(onBar(u), `${name} ${layer}: a key at bar ${u}`)
        if (!i || g === keys[i - 1][1]) return
        const len = u - keys[i - 1][0]
        if (len === 0) assert.ok(DRUMS.has(layer) || u === 0, `${name} ${layer} steps at bar ${u}`)
        else assert.ok(len >= 1, `${name} ${layer}: ramps over ${len} bar at ${u}`)
      })
    // nothing pitched ever drops out in a step: the pad plays from the first bar to the last
    assert.ok(envAt(P.env.pad, P.end) === 1 && envAt(P.env.pad, 0) === 1, name)
  }
})

test('score: anchors A, B and C on downbeats, in every locale and however long the takes run', () => {
  for (const [name, clock, P] of plans) {
    assert.equal(P.bar0, Math.round(clock.anchors.A * 1e4) / 1e4, name)
    for (const k of ['A', 'B', 'C']) {
      const beats = (clock.anchors[k] - clock.bar0) / BAR
      assert.ok(Math.abs(beats - Math.round(beats)) * BAR <= 1 / 30, `${name} ${k}: bar ${beats}`)
      assert.ok(
        P.events.some((e) => e.layer === 'crash' && Math.abs(e.t - clock.anchors[k]) < 1e-6),
        `${name}: a crash on ${k}`,
      )
    }
  }
})

test('score: the melody keeps out of her sentences, and the motif ends on the end card', () => {
  for (const [name, clock, P] of plans) {
    const sents = Object.values(clock.lines).flatMap((L) => L.sents)
    // the music box's two statements in the cold open (bars -5 and -3) sit under her on purpose:
    // the film's first sound is the motif, and the open has no pause long enough for it
    const coldOpen = P.bar0 - 3 * BAR + MOTIF[MOTIF.length - 1][0] * (BAR / 4)
    for (const e of P.events)
      if (e.layer === 'bell' || (e.layer === 'musicbox' && e.t > coldOpen + 1e-6))
        assert.ok(
          !sents.some((s) => e.t > s.t0 - 0.15 && e.t < s.t1 + 0.25),
          `${name}: ${e.layer} at ${e.t} under a sentence`,
        )
    const box = P.events.filter((e) => e.layer === 'musicbox')
    const last = box[box.length - 1]
    assert.equal(last.m, MOTIF[MOTIF.length - 1][1], name)
    assert.ok(Math.abs(last.t - (P.bar0 + P.end * BAR)) < 1e-6, `${name}: ${last.t}`)
  }
})

test('envelopes: a raised cosine between keys, a step where two keys share a bar', () => {
  const keys = [
    [0, 0],
    [0, 0.5],
    [2, 1],
    [4, 1],
    [5, 0],
  ]
  assert.equal(envAt(keys, -1), 0)
  assert.equal(envAt(keys, 0), 0.5)
  assert.ok(Math.abs(envAt(keys, 1) - 0.75) < 1e-9)
  assert.equal(envAt(keys, 3), 1)
  assert.ok(Math.abs(envAt(keys, 4.5) - 0.5) < 1e-9)
  assert.equal(envAt(keys, 9), 0)
})

test('the bed: one gain for the whole film, from the voice, lowered at most 2 dB', () => {
  // voiced: the music over [slam + 2 s, end card] sits BED.lu under the voice; mix() has already
  // brought the whole stem to -16 LUFS, so the gain is the offset of that span from the whole
  assert.equal(bedGain({ voiced: true, wholeLufs: -20, spanLufs: -19.5 }), -BED.lu - 0.5)
  assert.equal(bedGain({ voiced: false, wholeLufs: -20, spanLufs: null }), BED.silentDb)
  assert.equal(BED.lu, 11)
  // the check lowers the whole bed when a sentence clears it by under 8 dB, never by more than 2
  assert.equal(bedLower(10.2), 0)
  assert.equal(bedLower(8), 0)
  assert.ok(Math.abs(bedLower(7.2) - 1.3) < 1e-9)
  assert.equal(bedLower(3), BED.maxLower)
  assert.equal(typeof bedGain({ voiced: true, wholeLufs: -18, spanLufs: -18 }), 'number')
})
