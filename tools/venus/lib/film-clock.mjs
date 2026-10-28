// The introduction film's clock: when every sentence of every line is on screen, in one locale.
//
//   import { buildClock, captionTimes } from './lib/film-clock.mjs'
//   const C = buildClock('de')             // the silent clock, or the takes in VENUS_VOICE/de/
//   C.W(17.1)                              // an English board time -> this locale's film time
//   C.lines['intro-04'].sents[1].t0        // when "…Ich hab ein paar." starts in the German cut
//
// The board (data/film-intro.json `at`) times every sentence for the English silent cut. Another
// locale, or a voice take, makes a sentence longer or shorter; the film is re-timed from that alone:
//
//   silent clock  a sentence is on screen max(0.5 s, chars / 14), the "…" not counted. English
//                 reproduces the board exactly (the test checks it).
//   a take        voice/<lang>/intro-NN.wav + intro-NN.json (the ElevenLabs character alignment,
//                 the day renderer's shape) replaces the silent clock for that line. The film places
//                 each sentence of the take on its own, so the board's gaps between sentences stay.
//   the warp      a sentence that runs longer than on the board pushes everything after its end
//                 later by the difference (W). Inside the 120 bpm sections the push is rounded up
//                 to whole beats (0.5 s), so every cut and every slap stays on the music's grid. A
//                 shorter sentence pushes nothing: the film never runs faster than the board.
//
// Pure: no browser, no audio. The film (film.mjs) reads the takes' loudness itself, for lip sync.
import fs from 'node:fs'
import path from 'node:path'
import { GEN } from './paths.mjs'
import { sentences, weight } from './voice.mjs'

export const FILM = JSON.parse(fs.readFileSync(path.join(GEN, 'data/film-intro.json'), 'utf8'))
export const LOCALES = ['en', 'tr', 'de', 'es', 'fr', 'pt-BR', 'ru', 'ar']
export const CLOCK = {
  cps: 14, // characters a second, the reading pace the board is timed for
  minSent: 0.5, // no sentence is on screen for less
  beat: 0.5, // one beat at 120 bpm
  captionLead: 0.1, // the bubble opens this long before its first sentence
  captionHold: 0.4, // and closes this long after its last
  cutGuard: 0.25, // a bubble never clears this close to a cut
  swapGap: 0.3, // a shorter gap to the next line swaps the text instead of closing the bubble
}
// The board's beat-grid sections, in English seconds: the four 120 bpm beds (title to the zoomies,
// looks to the sticker slaps, the race and the wall, the hello ring to the deal)
export const GRID = [
  [10.6, 19.1],
  [21.4, 40.9],
  [40.9, 52.4],
  [52.9, 63.7],
  [75.0, 86.0],
]
export const inGrid = (t) => GRID.some(([a, b]) => t >= a && t < b)
const r3 = (x) => Math.round(x * 1000) / 1000

// Caption words: split at plain spaces only, and a lone "?" or "!" (French spacing) rides with the
// word before it, so a wrap never strands it at the start of a line. a/b are character offsets.
export function tokens(text, a = 0, b = text.length) {
  const out = [],
    re = /[^ ]+/g,
    s = text.slice(a, b)
  let m
  while ((m = re.exec(s))) {
    const tok = { text: m[0], a: a + m.index, b: a + m.index + m[0].length }
    const prev = out[out.length - 1]
    if (prev && /^[?!:;»]+$/u.test(tok.text)) {
      prev.text += ' ' + tok.text
      prev.b = tok.b
    } else out.push(tok)
  }
  return out
}
// characters a sentence is timed by: the "…" is a pause, not text
export const readChars = (s) => [...s.replace(/…/g, '')].length
export const silentSeconds = (s) => Math.max(CLOCK.minSent, readChars(s) / CLOCK.cps)

// the take for one line, if there is one: per sentence [t0, t1] in the take's own time, and the
// alignment (for the words)
export function readTake(voiceDir, lang, id, text) {
  const wav = path.join(voiceDir, lang, `${id}.wav`),
    json = wav.replace(/\.wav$/, '.json')
  if (!fs.existsSync(wav) || !fs.existsSync(json)) return null
  const raw = JSON.parse(fs.readFileSync(json, 'utf8'))
  const al = raw.alignment || raw
  const chars = al.characters,
    st = al.character_start_times_seconds,
    en = al.character_end_times_seconds
  if (!chars || chars.join('') !== text)
    throw new Error(`${lang}/${id}.json: its characters are not the line's text "${text}"`)
  const spans = sentences(text).map((p) => {
    let a = p.a
    while (a < p.b && /[…\s]/u.test(text[a])) a++
    return { t0: st[a], t1: en[p.b - 1] }
  })
  return { wav, json, alignment: al, spans }
}

// the words of one sentence spread over [t0, t1]: from the take's alignment when there is one,
// else by voice.mjs's rough weight (vowels long, spaces and stops short)
function wordsOf(text, p, t0, t1, take, offset) {
  const toks = tokens(text, p.a, p.b)
  if (take) {
    const st = take.alignment.character_start_times_seconds,
      en = take.alignment.character_end_times_seconds
    return toks.map((k) => {
      let a = k.a
      while (a < k.b - 1 && /[…]/u.test(text[a])) a++
      return { text: k.text, t0: r3(st[a] + offset), t1: r3(en[k.b - 1] + offset) }
    })
  }
  const w = toks.map((k) =>
    [...text.slice(k.a, k.b).replace(/…/g, '')].reduce((s, c) => s + weight(c), 0.6),
  )
  const W = w.reduce((s, x) => s + x, 0) || 1
  let u = t0
  return toks.map((k, i) => {
    const d = ((t1 - t0) * w[i]) / W
    const o = { text: k.text, t0: r3(u), t1: r3(u + d) }
    u += d
    return o
  })
}

// The clock for one locale. voiceDir: where takes are looked for (null: the silent clock only).
export function buildClock(lang, { voiceDir = null, film = FILM } = {}) {
  if (!LOCALES.includes(lang)) throw new Error(`unknown locale ${lang}`)
  // every sentence in board order, with how much later it pushes what follows
  const all = []
  const lines = {}
  for (const L of film.lines) {
    const text = L.text[lang]
    if (!text) throw new Error(`${L.id} has no ${lang} text`)
    const parts = sentences(text)
    if (parts.length !== L.at.length)
      throw new Error(`${L.id} ${lang}: ${parts.length} sentences, the board has ${L.at.length}`)
    const take = voiceDir ? readTake(voiceDir, lang, L.id, text) : null
    lines[L.id] = { id: L.id, beat: L.beat, text, take, reveal: L.reveal || 'karaoke', sents: [] }
    parts.forEach((p, i) => {
      const [a, b] = L.at[i]
      const nat = take ? take.spans[i].t1 - take.spans[i].t0 : silentSeconds(p.text)
      // the board is written to the hundredth, so a few milliseconds over is no push at all
      const over = nat - (b - a) > 0.015 ? nat - (b - a) : 0
      const push = inGrid(a) && over > 0 ? Math.ceil(over / CLOCK.beat - 1e-6) * CLOCK.beat : over
      all.push({ id: L.id, i, a, b, nat, push, p })
    })
  }
  // W: board time -> film time. A push lands at its sentence's board end.
  const pushes = all.filter((s) => s.push > 0).map((s) => [s.b, s.push])
  const W = (t) => {
    let d = 0
    for (const [b, p] of pushes) if (b < t - 1e-9) d += p
    return r3(t + d)
  }
  for (const s of all) {
    const L = lines[s.id],
      F = film.lines.find((x) => x.id === s.id)
    const t0 = W(s.a),
      t1 = r3(t0 + s.nat)
    // a take is placed sentence by sentence: this sentence of the wav starts at t0
    const offset = L.take ? t0 - L.take.spans[s.i].t0 : 0
    const mode = F.modes[s.i]
    L.sents.push({
      i: s.i,
      text: s.p.text,
      t0,
      t1,
      mode,
      // a sentence after a "…" is not drawn until it starts; the bag run appears word by word
      hidden: L.reveal === 'append' || (s.i > 0 && /^…/u.test(s.p.text)),
      take: L.take ? { from: L.take.spans[s.i].t0, to: L.take.spans[s.i].t1, at: t0 } : null,
      words: wordsOf(L.text, s.p, t0, t1, L.take, offset),
    })
  }
  return { lang, W, lines, pushes, film }
}

// Bubble times for every line: { show, hide, swapIn } on each clock line. cuts: film times.
export function captionTimes(clock, cuts = []) {
  const order = clock.film.lines.map((L) => clock.lines[L.id])
  const near = (t) => cuts.find((c) => Math.abs(c - t) < CLOCK.cutGuard - 1e-9)
  for (const L of order) {
    const first = L.sents[0],
      last = L.sents[L.sents.length - 1]
    L.show = r3(first.t0 - CLOCK.captionLead)
    const chars = readChars(L.text)
    L.hide = r3(Math.max(last.t1 + CLOCK.captionHold, L.show + Math.max(1.2, chars / 15 + 0.4)))
    L.swapIn = false
  }
  for (let k = 0; k < order.length; k++) {
    const L = order[k],
      N = order[k + 1]
    // a cut close by: clear on it, or hold past it
    const c = near(L.hide)
    if (c !== undefined) L.hide = r3(L.hide < c ? c : c + CLOCK.cutGuard)
    if (N && N.show - L.hide < CLOCK.swapGap) {
      // swap the text instead of closing and reopening; on a cut, if one falls between the lines
      const lastEnd = L.sents[L.sents.length - 1].t1
      const cut = cuts.find(
        (x) => x >= lastEnd + 0.1 && x <= N.sents[0].t0 && Math.abs(x - N.show) <= CLOCK.swapGap,
      )
      const at = r3(cut ?? Math.max(N.show, lastEnd + 0.1))
      L.hide = at
      N.show = at
      N.swapIn = true
    }
  }
  return order
}

// A mouth for the silent cut: one opening per syllable (a vowel group) of every word she says on
// camera, brighter on i/e, rounder on o/u. Per frame, 0..1, the shape lib/audio.mjs analyseVoice
// returns for a recording, so the lip sync is the same code either way.
const VOWEL = /[aeiouyıöüäâêîôûéèàáíóúãõœаеёиоуыэюяاويآأإىۀ]+/giu
const BRIGHT = /[ieyıüéèêîíиеёэюяي]/iu
export function syntheticMouth(words, fps, frames, env, bright) {
  for (const w of words) {
    const groups = [...w.text.matchAll(VOWEL)].map((m) => m[0])
    const n = Math.max(1, groups.length),
      d = (w.t1 - w.t0) / n
    for (let j = 0; j < n; j++) {
      const a = w.t0 + j * d,
        b = a + d,
        peak = 0.62 + 0.3 * (((j * 7 + w.text.length * 3) % 5) / 4),
        br = groups[j] && BRIGHT.test(groups[j]) ? 0.85 : 0.35
      for (let f = Math.floor(a * fps); f <= Math.ceil(b * fps) && f < frames; f++) {
        if (f < 0) continue
        const u = (f / fps - a) / Math.max(1e-3, b - a)
        if (u < 0 || u > 1) continue
        const v = peak * Math.pow(Math.sin(Math.PI * u), 0.7)
        if (v > env[f]) {
          env[f] = v
          bright[f] = br
        }
      }
    }
  }
}
