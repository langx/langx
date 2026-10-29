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
  shownAt,
  vtt,
} from '../lib/film-clock.mjs'
import {
  SHOTS,
  TX,
  TITLE_HIT,
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
import { wrap } from '../lib/film-layers.mjs'
import { trk } from '../lib/layers.mjs'

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
    if (sh.id === 'bonk') S.top = 300
    Object.assign(sh, performShot(sh, S))
  }
  return { clock, shots }
}
const performed = new Map(LOCALES.map((l) => [l, perform(l)]))

test('the board: the English silent clock reproduces it, and the film is 93.14 s', () => {
  const C = buildClock('en')
  assert.deepEqual(C.pushes, [])
  for (const L of FILM.lines)
    L.at.forEach(([a, b], i) => {
      const s = C.lines[L.id].sents[i]
      assert.equal(s.t0, a, `${L.id}[${i}] starts on the board`)
      assert.ok(Math.abs(s.t1 - b) <= 0.015, `${L.id}[${i}] ends ${s.t1}, the board says ${b}`)
    })
  assert.equal(C.W(END_BOARD), END_BOARD)
  const shots = placeShots(C)
  assert.equal(shots[shots.length - 1].T1, +(END_BOARD + END_LEN).toFixed(3))
  assert.equal(shots[shots.length - 1].T1, 93.14)
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

// The bubble and the .vtt are built from the clock's sentences, so the sentences must add up to
// the line: a "…" that opens a line ("…Almost everything.") used to fall between them unseen
test('lines: the sentences add up to the line, character for character, "…" and NBSP included', () => {
  for (const lang of LOCALES)
    for (const L of Object.values(buildClock(lang).lines))
      assert.equal(
        L.sents.map((s) => s.text).join(' '),
        L.text,
        `${L.id} ${lang}: ${L.sents.map((s) => s.text).join(' | ')}`,
      )
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
    for (let t = 0; t <= END_BOARD + END_LEN; t += 0.05) {
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

test('the warp: no two voiced sentences overlap, back-to-back ones (the bag run) included', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'venus-film-'))
  try {
    // every line voiced, every sentence 0.4 s longer than its board time, 0.2 s apart in the take
    fs.mkdirSync(path.join(dir, 'en'))
    for (const L of FILM.lines) {
      const text = L.text.en,
        st = new Array(text.length).fill(0),
        en = new Array(text.length).fill(0)
      let u = 0.1
      sentences(text).forEach((p, i) => {
        const d = L.at[i][1] - L.at[i][0] + 0.4
        for (let k = p.a; k < p.b; k++) {
          st[k] = +(u + (d * (k - p.a)) / (p.b - p.a)).toFixed(3)
          en[k] = +(u + (d * (k + 1 - p.a)) / (p.b - p.a)).toFixed(3)
        }
        for (let k = p.b; k < text.length; k++) st[k] = en[k] = en[p.b - 1]
        u += d + 0.2
      })
      fs.writeFileSync(path.join(dir, 'en', `${L.id}.wav`), '')
      fs.writeFileSync(
        path.join(dir, 'en', `${L.id}.json`),
        JSON.stringify({
          alignment: {
            characters: [...text],
            character_start_times_seconds: st,
            character_end_times_seconds: en,
          },
        }),
      )
    }
    const C = buildClock('en', { voiceDir: dir })
    const all = FILM.lines.flatMap((L) => C.lines[L.id].sents.map((s) => ({ id: L.id, ...s })))
    for (let k = 1; k < all.length; k++)
      assert.ok(
        all[k].t0 >= all[k - 1].t1 - 1e-6,
        `${all[k].id}[${all[k].i}] starts ${all[k].t0}, ${all[k - 1].id}[${all[k - 1].i}] ends ${all[k - 1].t1}`,
      )
    // and each day of the bag run cuts after its "Bag." is said
    const bag = C.lines['intro-12'].sents
    for (const [i, id] of [
      [0, 'd59'],
      [1, 'd66'],
    ])
      assert.ok(C.W(SHOTS.find((s) => s.id === id).from) >= bag[i].t1 - 1e-6, id)
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

test('captions: a sentence after a "…" starts a line; other breaks go to a sentence end', () => {
  // every character 30 px wide, a space 14
  const words = (text) => text.split(' ')
  const m = (ws) => Object.fromEntries([[' ', 14], ...ws.map((x) => [x, [...x].length * 30])])
  const joined = (lines) => lines && lines.map((l) => l.join(' '))
  const a = words('Every star needs an entrance. …I have a few.')
  // the "…" sentence on its own line leaves the first too long for two lines: three, balanced
  assert.equal(wrap(a, m(a), 760, 2, { must: [5] }), null)
  assert.deepEqual(joined(wrap(a, m(a), 760, 3, { must: [5] })), [
    'Every star needs',
    'an entrance.',
    '…I have a few.',
  ])
  // without the rule the same words balance across the sentence boundary, and no line ends on "an"
  assert.deepEqual(joined(wrap(a, m(a), 760, 2)), [
    'Every star needs',
    'an entrance. …I have a few.',
  ])
  const d = words('I look good in everything.')
  assert.deepEqual(joined(wrap(d, m(d), 500, 2)), ['I look good', 'in everything.'])
  const b = words("Honestly? Best co-star I've ever had.")
  assert.deepEqual(joined(wrap(b, m(b), 760, 2, { prefer: [1] })), [
    'Honestly?',
    "Best co-star I've ever had.",
  ])
  // only between sentences: none when a sentence alone is too wide
  assert.equal(wrap(b, m(b), 700, 2, { prefer: [1], only: true }), null)
  // what fits on one line stays on one
  const c = words('Bag. Bag.')
  assert.deepEqual(joined(wrap(c, m(c), 760, 2, { prefer: [1] })), ['Bag. Bag.'])
})

test('captions: shortEnd false never leaves a little word hanging at a line end', () => {
  const m = (ws) => Object.fromEntries([[' ', 14], ...ws.map((x) => [x, [...x].length * 30])])
  const ws = 'Лучший партнёр по съёмкам за всю карьеру.'.split(' ')
  // narrow enough that the only two-line break that fits leaves "по" at the end of line one
  const soft = wrap(ws, m(ws), 700, 2)
  assert.equal(soft[0][soft[0].length - 1], 'по')
  assert.equal(wrap(ws, m(ws), 700, 2, { shortEnd: false }), null)
  const strict = wrap(ws, m(ws), 700, 3, { shortEnd: false })
  for (const ln of strict.slice(0, -1)) assert.notEqual(ln[ln.length - 1], 'по')
})

test('lines: the co-star (the viewer) is addressed in the generic form, not the feminine', () => {
  const L = FILM.lines.find((x) => x.id === 'intro-22')
  assert.match(L.text.es, /\bEl mejor coprotagonista\b.*\bel único\./u)
  assert.match(L.text['pt-BR'], /\bO melhor coprotagonista\b.*\bo único\./u)
  for (const lang of ['es', 'pt-BR']) assert.doesNotMatch(L.text[lang], /\b(la|a) única\b/u)
})

test('captions: a line split into blocks leaves no gap between its WebVTT cues', () => {
  const parse = (text) =>
    text
      .split('\n\n')
      .slice(1)
      .map((c) => {
        const [id, span] = c.trim().split('\n')
        const [a, b] = span.split(' --> ').map((x) => {
          const [h, mm, sec] = x.split(':')
          return +h * 3600 + +mm * 60 + +sec
        })
        return { id, a, b }
      })
  // intro-22 as film.mjs lays it out: the said sentences, then the whisper in a block of its own
  const { clock, shots } = performed.get('en')
  const L = captionTimes(clock, flashesAndCuts(shots).cuts).find((x) => x.id === 'intro-22')
  const sent = (s) => ({ text: s.text, at: shownAt(s) })
  const w = L.sents[2]
  const cues = parse(
    vtt([
      {
        ...L,
        blocks: [
          { start: L.show, sents: L.sents.slice(0, 2).map(sent) },
          { start: w.t0 - 0.14, sents: [sent(w)] },
        ],
      },
    ]),
  )
  assert.equal(cues.length, 2)
  assert.ok(near(cues[0].b, cues[1].a, 1e-3), `${cues[0].b} -> ${cues[1].a}`)
  assert.ok(near(cues[1].a, shownAt(w), 2e-3))
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
      if (sh.day || sh.wall) continue
      assert.ok(sh.anim, `${lang} ${sh.id}`)
      // the animator steps forward through the whole shot without throwing
      for (let f = 0; f < Math.round((sh.T1 - sh.T0 + sh.off) * 30); f += 15) sh.anim.at(f)
    }
  }
})

test('captions: a dash or a lone "?" never starts a line', () => {
  const words = (text) => text.split(' ')
  const m = (ws) => Object.fromEntries([[' ', 14], ...ws.map((x) => [x, [...x].length * 30])])
  const joined = (lines) => lines && lines.map((l) => l.join(' '))
  // the narrowest balance would put the dash first on line two; it stays with "РОЛИ"
  const a = words('В ГЛАВНОЙ РОЛИ — ОНА САМА')
  for (const line of joined(wrap(a, m(a), 420, 2)).slice(1)) assert.ok(!/^—/.test(line), line)
  const b = words('Qui a monté ça ?')
  for (const line of joined(wrap(b, m(b), 330, 2)).slice(1)) assert.ok(!/^\?/.test(line), line)
})

test('captions: the opening line clears before the title slam, and the bag run opens on its first word', () => {
  const C = buildClock('en')
  const { cuts } = flashesAndCuts(performed.get('en').shots)
  const caps = captionTimes(C, cuts)
  const by = Object.fromEntries(caps.map((x) => [x.id, x]))
  // "…I made a film." is said by 10.22 and held 0.4 s: gone before VENUS lands over her (no cut there
  // any more, the camera pulls back onto the title in the same shot)
  assert.equal(by['intro-03'].hide, 10.62)
  assert.ok(by['intro-03'].hide <= TITLE_HIT)
  assert.equal(by['intro-12'].show, by['intro-12'].sents[0].t0)
})

test('captions: the WebVTT never shows a sentence before the bubble does', () => {
  // one block per line (film.mjs may split a long line into more; each splits the same way)
  const parse = (text) =>
    text
      .split('\n\n')
      .slice(1)
      .map((c) => {
        const [id, span, ...words] = c.trim().split('\n')
        const [a, b] = span.split(' --> ').map((x) => {
          const [h, m, sec] = x.split(':')
          return +h * 3600 + +m * 60 + +sec
        })
        return { id, a, b, text: words.join(' ') }
      })
  for (const lang of LOCALES) {
    const { clock, shots } = performed.get(lang)
    const caps = captionTimes(clock, flashesAndCuts(shots).cuts).map((L) => ({
      ...L,
      blocks: [{ start: L.show, sents: L.sents.map((s) => ({ text: s.text, at: shownAt(s) })) }],
    }))
    const cues = parse(vtt(caps))
    for (const L of caps) {
      const mine = cues.filter((c) => c.id === L.id || c.id.startsWith(L.id + '-'))
      assert.ok(near(mine[0].a, L.show, 1e-3), `${lang} ${L.id} opens`)
      // every cue says exactly what the bubble shows when it starts: nothing held back yet
      for (const c of mine)
        assert.equal(
          c.text,
          L.sents
            .filter((s) => shownAt(s) <= c.a + 1e-3)
            .map((s) => s.text)
            .join(' '),
          `${lang} ${c.id} at ${c.a}`,
        )
      for (const s of L.sents) {
        // and a held-back sentence opens a cue of its own, on the frame it shows
        if (s.hidden && s !== L.sents[0])
          assert.ok(
            mine.some((c) => Math.abs(c.a - shownAt(s)) < 2e-3 && c.text.endsWith(s.text)),
            `${lang} ${L.id}: no cue for "${s.text}"`,
          )
      }
    }
  }
  // the English board: the bag run is four cues, one per "Bag."
  const en = parse(
    vtt(
      captionTimes(buildClock('en'), flashesAndCuts(performed.get('en').shots).cuts).map((L) => ({
        ...L,
        blocks: [{ start: L.show, sents: L.sents.map((s) => ({ text: s.text, at: shownAt(s) })) }],
      })),
    ),
  )
  assert.deepEqual(
    en.filter((c) => c.id.startsWith('intro-12')).map((c) => c.text),
    ['Bag.', 'Bag. Bag.', 'Bag. Bag. Bag.', 'Bag. Bag. Bag. …Different bag.'],
  )
})

test('lines: 21 of them, and intro-05 is gone from the board', () => {
  assert.equal(FILM.lines.length, 21)
  assert.ok(!FILM.lines.some((L) => L.id === 'intro-05'))
  for (const lang of LOCALES)
    assert.ok(!Object.keys(buildClock(lang).lines).includes('intro-05'), lang)
})

test('joins: every shot says how it is entered, and only a day of the race swipes in', () => {
  for (const lang of LOCALES)
    performed.get(lang).shots.forEach((sh, i) => {
      assert.ok(TX.includes(sh.tx), `${lang} ${sh.id}: ${sh.tx}`)
      assert.equal(sh.tx === 'first', i === 0, `${lang} ${sh.id}`)
      // a swipe is the one join that changes the whole picture: the race's, nowhere else
      assert.equal(sh.tx === 'swipe', !!sh.day, `${lang} ${sh.id}`)
    })
})

// her camera at shot time u, as film.mjs drawShot moves it (the hit's shake aside)
function camAt(cam, u) {
  let z = trk(cam.z, u)
  for (const b of cam.bumps || [])
    if (u >= b && u < b + 0.35) z *= 1 + 0.06 * Math.sin(((u - b) / 0.35) * Math.PI)
  return { z, lift: cam.lift ? trk(cam.lift, u) : 0, dx: cam.dx ? trk(cam.dx, u) : 0 }
}

test('camera: no snaps, the zoom never faster than 1.2 a second, and a cont join keeps the frame', () => {
  for (const lang of LOCALES) {
    const { shots } = performed.get(lang)
    for (const sh of shots) {
      if (!sh.cam) continue
      // the first cut snapped in 0.14 s and 0.1 s; every move now takes at least 0.3 s
      for (const k of ['z', 'lift', 'dx'])
        (sh.cam[k] || []).forEach((key, i, keys) => {
          if (i && key[1] !== keys[i - 1][1])
            assert.ok(key[0] - keys[i - 1][0] >= 0.3 - 1e-6, `${lang} ${sh.id} ${k} at ${key[0]}`)
        })
      for (let u = sh.off; u < sh.off + sh.T1 - sh.T0; u += 1 / 30) {
        const rate = Math.abs(camAt(sh.cam, u + 1 / 30).z - camAt(sh.cam, u).z) * 30
        assert.ok(rate <= 1.2, `${lang} ${sh.id}: z moves ${rate.toFixed(2)} a second at ${u}`)
      }
    }
    for (let i = 1; i < shots.length; i++) {
      const a = shots[i - 1],
        b = shots[i]
      if (b.tx !== 'cont') continue
      const x = camAt(a.cam, a.off + a.T1 - a.T0),
        y = camAt(b.cam, b.off)
      assert.ok(Math.abs(x.z - y.z) <= 0.03, `${lang} ${b.id}: z ${x.z} -> ${y.z}`)
      assert.ok(Math.abs(x.lift - y.lift) <= 10, `${lang} ${b.id}: lift ${x.lift} -> ${y.lift}`)
      assert.ok(Math.abs(x.dx - y.dx) <= 10, `${lang} ${b.id}: dx ${x.dx} -> ${y.dx}`)
    }
  }
})

// what she has on at shot time u: the outfit, the bag (0 away, 1 up), and the items worn so far
function wearing(sh, u) {
  const last = (keys, d) => (keys || []).filter((k) => k[0] <= u + 1e-6).reduce((v, k) => k[1], d)
  const w = { outfit: last(sh.c.k.k.outfit, null), bag: last(sh.c.k.k.bag, 0) }
  for (const [t, it] of sh.items) if (t <= u + 1e-6) Object.assign(w, it)
  return w
}

test('wardrobe: nothing she wears changes without a poof or a flash on it', () => {
  for (const lang of LOCALES) {
    const { shots } = performed.get(lang)
    for (const sh of shots) {
      if (!sh.c) continue
      const covers = [...(sh.c.poofs || []).map((p) => p.t), ...sh.c.fx.flashes]
      const changes = sh.items.map(([t, it]) => [JSON.stringify(it), t])
      for (const k of ['outfit', 'bag'])
        (sh.c.k.k[k] || []).forEach((key, i, keys) => {
          // a number (the bag) starts moving at the key before; a name (the outfit) swaps on its key
          if (i && key[1] !== keys[i - 1][1])
            changes.push([k, typeof key[1] === 'number' ? keys[i - 1][0] : key[0]])
        })
      for (const [what, t] of changes)
        assert.ok(
          covers.some((x) => Math.abs(x - t) <= 0.1 + 1e-6),
          `${lang} ${sh.id}: ${what} at ${t}, no poof or flash within 0.1 s`,
        )
    }
    // a join that is not a poof keeps what she has on
    for (let i = 1; i < shots.length; i++) {
      const a = shots[i - 1],
        b = shots[i]
      if (!a.c || !b.c || b.tx === 'poof') continue
      assert.deepEqual(wearing(a, a.off + a.T1 - a.T0), wearing(b, b.off), `${lang} ${b.id}`)
    }
  }
})

test('pacing: no shot outside the race under 1.2 s, no wordless stretch over 3.5 s', () => {
  for (const lang of LOCALES) {
    const { clock, shots } = performed.get(lang)
    for (const sh of shots)
      if (!sh.day) assert.ok(sh.T1 - sh.T0 >= 1.2 - 1e-6, `${lang} ${sh.id}: ${sh.T1 - sh.T0}`)
    // from the first frame to the end card (which has its own minute of quiet)
    const ss = Object.values(clock.lines)
      .flatMap((L) => L.sents)
      .sort((a, b) => a.t0 - b.t0)
    let t = 0
    for (const s of ss) {
      assert.ok(s.t0 - t <= 3.5, `${lang}: nothing said from ${t} to ${s.t0}`)
      t = Math.max(t, s.t1)
    }
    assert.ok(clock.W(END_BOARD) - t <= 3.5, `${lang}: nothing said from ${t} to the end card`)
  }
})
