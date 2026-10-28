// "Venus: Starring Herself", the introduction film behind the Venus page's "Watch the introduction":
// one cut per locale, 1080x1920, 30 fps, H.264 + AAC, -14 LUFS / -1 dBTP. Until the takes exist it
// is silent but for music and SFX, every line a burned-in subtitle.
//
//   node film.mjs --lang en               -> $VENUS_OUT/intro/en/venus-intro-en.mp4, .jpg (the cover:
//                                            the title card), .vtt, -preview.mp4 (720x1280, < 8 MB)
//   node film.mjs --lang en --strip 15    a contact sheet of every 15th frame (work/), no video
//   node film.mjs --lang en --at 12.4,64  full-size stills at those BOARD times (work/)
//   node film.mjs --lang en --audio       the sound alone, no frames: work/audio/film-en.m4a, the
//                                         stems it was mixed from ({voice,music,sfx}-en.wav) and
//                                         film-en.json (sentences, SFX, the score's plan, the gains)
//   node film.mjs --all [--jobs 4]        every locale, in parallel processes
//   node film.mjs --script <file>         the voice script: every line, its text and its characters
//                                         per locale (what a voicing session is billed by)
//   options: --pages <n> (browser pages, default 4)  --end handoff|splash (the end card)
//            --sheets <dir> (with a full render: a frame every 0.5 s as one contact sheet, and the
//            key beats as another, into <dir>)
//
// The board is data/film-intro.json: every line and its sentences' times on the English silent cut.
// lib/film-clock.mjs turns that into this locale's clock (a longer sentence pushes what follows, from
// the title slam on by whole beats of the one 120 bpm score), and a take in
// VENUS_VOICE/<lang>/intro-NN.wav (+ .json
// alignment) replaces the silent timing of its line. Nothing here is timed to a sound file: every beat
// is a board time or a sentence, mapped through the clock, so re-running with takes in place is the
// whole re-timing job. The film never voices a line itself: no take, no voice.
//
// What she does is lib/film-shots.mjs, in the day videos' vocabulary; the race through the days is
// the days themselves (render.mjs frameSvgs on planVideo(day, lang)), mouth shut; the end card is
// lib/endcard.mjs; what only the film draws is lib/film-layers.mjs.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync, spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import {
  buildClock,
  captionTimes,
  shownAt,
  vtt,
  syntheticMouth,
  LOCALES,
  FILM,
  silentSeconds,
} from './lib/film-clock.mjs'
import {
  placeShots,
  shotClock,
  performShot,
  HELLO,
  END_BOARD,
  PRINT,
  BLEP_HERO,
  BONK_FRAME,
  BONK_CAM,
  BAG_CAM,
  FLATS,
  BURSTS,
  WALL_TIMES,
  bonkClock,
} from './lib/film-shots.mjs'
import { buildScore, EXTRA_EXPR } from './lib/score.mjs'
import { planVideo } from './lib/intro.mjs'
import { frameSvgs, fitUnderLabel, FPS, G, BASE, HEAD_H } from './render.mjs'
import { sentences } from './lib/voice.mjs'
import { openBrowser } from './lib/frames.mjs'
import { sfxBus, mix, measure, decode, analyseVoice } from './lib/audio.mjs'
import { planScore, renderScore, bedGain, bedLower } from './lib/film-score.mjs'
import { ffStderr } from './lib/synth/say.mjs'
import { formatNumber, streakLabel, isRTL } from './lib/i18n.mjs'
import { RIG, REPO, OUT_ROOT, WORK, CACHE, VOICE_DIR } from './lib/paths.mjs'
import * as L from './lib/layers.mjs'
import * as FL from './lib/film-layers.mjs'
import * as EC from './lib/endcard.mjs'
import { applyItemPose, itemLayers, itemsFor } from './lib/items.mjs'

const req = createRequire(import.meta.url)
const V = req(path.join(RIG, 'venus-rig.js'))
Object.assign(V.EXPR, EXTRA_EXPR)
const { EASE, clamp } = L
const r3 = (x) => Math.round(x * 1000) / 1000
export const FILM_DIR = path.join(OUT_ROOT, 'intro')
const STICKERS = path.join(REPO, 'apps/mobile/assets/stickers/venus')
// the published day covers the wall is made of (read only; nothing is ever written there). The
// locale in the URL is the LOCALES entry, never the string the command line passed, and a URL that
// is not on the media origin is refused, so no argument can point this fetch anywhere else.
const MEDIA_ORIGIN = 'https://media.langx.io'
function coverUrl(lang, d, ext = 'jpg') {
  const l = LOCALES.find((x) => x === lang)
  if (!l || !Number.isInteger(d) || d < 1 || d > 100) throw new Error(`no day cover ${lang} ${d}`)
  const day = String(d).padStart(3, '0')
  const url = new URL(`/venus/v1/${l}/venus-day${day}-${l}.${ext}`, MEDIA_ORIGIN)
  if (url.origin !== MEDIA_ORIGIN) throw new Error(`${url.href} is not on ${MEDIA_ORIGIN}`)
  return url.href
}
// a JPEG starts FF D8 FF: an error page or a truncated body is not handed on as a cover
const isJpeg = (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
const ff = (args) =>
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
    stdio: ['ignore', 'ignore', 'inherit'],
  })
export const filmFile = (lang, suffix = '.mp4') =>
  path.join(FILM_DIR, lang, `venus-intro-${lang}${suffix}`)
// the cover is the title card, on the board's 12.40
const COVER_AT = 12.4
// the beats a review sheet shows, on the board
export const KEY_BEATS = [
  0.3, 2.0, 5.5, 7.8, 9.6, 10.9, 12.4, 13.4, 14.2, 15.2, 16.4, 17.6, 19.0, 20.9, 22.4, 23.0, 25.2,
  26.4, 27.4, 28.4, 29.2, 30.4, 33.0, 34.8, 37.4, 38.4, 39.6, 41.0, 43.0, 45.0, 46.9, 48.9, 50.0,
  51.4, 53.0, 55.0, 57.6, 58.4, 59.0, 60.1, 61.5, 62.9, 64.5, 67.2, 70.0, 71.5, 72.8, 74.3, 76.0,
  77.3, 78.9, 80.8, 82.2, 85.0, 87.3, 88.3, 90.5,
]

// ------------------------------------------------------------------ captions
// Lays every line out as the bubble will draw it: one block per run of sentences that fits the
// house sizes (64/58 px on two lines, 54/48 on three), a whispered sentence always its own block,
// and a line that fits nowhere split at a sentence boundary into consecutive bubbles.
async function layoutCaptions(B, clock, cuts, lang) {
  const MAXW = 760
  const widths = {}
  const measured = async (F, words) => {
    const k = String(F)
    widths[k] = widths[k] || {}
    const need = [...new Set(words)].filter((w) => !(w in widths[k]))
    if (need.length) {
      const r = await B.measure([...need, ' '], `900 ${F}px ${FL.FILM_FONT}`)
      need.forEach((w, i) => (widths[k][w] = r[i]))
      widths[k][' '] = r[r.length - 1]
    }
    return widths[k]
  }
  const SIZES = [
    [64, 2],
    [58, 2],
    [54, 3],
    [48, 3],
  ]
  // A caption of sentences: breaks only between them, down to 54 px on three lines if need be;
  // else every sentence still starts a line, one of them broken too (54 px, three lines); and only
  // then the house sizes with a break anywhere. A line never ends one sentence and starts the next
  // while a size allows otherwise. And when the layout found leaves a little word ("по", "a")
  // hanging at a line's end, the same breaks a size down, then the looser tries, go without it
  // first ("Лучший партнёр / по съёмкам", not "Лучший партнёр по / съёмкам").
  const fit = async (ws, br) => {
    const sentences = br.prefer.length || br.must.length
    const each = { must: [...br.must, ...br.prefer].sort((a, b) => a - b) }
    const tries = sentences
      ? [
          ...SIZES.slice(0, 3).map(([F, n]) => [F, n, { ...br, only: true }]),
          [54, 3, each],
          ...SIZES.map(([F, n]) => [F, n, br]),
        ]
      : SIZES.map(([F, n]) => [F, n, br])
    const hangs = (lines) => lines.slice(0, -1).some((ln) => FL.shortWord(ln[ln.length - 1]))
    for (let i = 0; i < tries.length; i++) {
      const [F, n, opt] = tries[i]
      const lines = FL.wrap(ws, await measured(F, ws), MAXW, n, opt)
      if (!lines) continue
      if (!hangs(lines)) return { F, lines }
      const smaller = SIZES.filter(([F2]) => F2 < F).map(([F2, n2]) => [F2, Math.max(n, n2), opt])
      for (const [F2, n2, o2] of [...smaller, ...tries.slice(i + 1)]) {
        const l2 = FL.wrap(ws, await measured(F2, ws), MAXW, n2, { ...o2, shortEnd: false })
        if (l2) return { F: F2, lines: l2 }
      }
      return { F, lines }
    }
    return null
  }
  const caps = captionTimes(clock, cuts)
  for (const Ln of caps) {
    const S = Ln.sents
    const groups = []
    S.forEach((s, i) => {
      const g = groups[groups.length - 1]
      if (g && (s.mode === 'whisper') === (S[g[0]].mode === 'whisper')) g.push(i)
      else groups.push([i])
    })
    const blocks = []
    // where the sentences of a block start, as word indices (FL.wrap)
    const breaks = (g) => {
      const prefer = [],
        must = []
      let k = 0
      g.forEach((i, j) => {
        if (j) (/^…/u.test(S[i].text) ? must : prefer).push(k)
        k += S[i].words.length
      })
      return { prefer, must }
    }
    const place = async (g) => {
      const words = g.flatMap((i) => S[i].words.map((w) => ({ ...w, hideUntil: shownAt(S[i]) })))
      const f = await fit(
        words.map((w) => w.text),
        breaks(g),
      )
      if (f) {
        let wi = 0
        blocks.push({
          F: f.F,
          words,
          lines: f.lines.map((ln) => ln.map(() => wi++)),
          whisper: S[g[0]].mode === 'whisper',
          tails: g.map((i) => ({ t: S[i].t0, on: S[i].mode !== 'vo' })),
          start: S[g[0]].t0 - 0.14,
          text: g.map((i) => S[i].text).join(' '),
          // when each sentence shows: a held-back one (after a "…", or the bag run's appends) on
          // the frame its words do, the others with the bubble
          sents: g.map((i) => ({ text: S[i].text, at: shownAt(S[i]) })),
        })
        return
      }
      if (g.length < 2) throw new Error(`${Ln.id} ${lang}: "${S[g[0]].text}" does not fit at 48 px`)
      // the longest run of sentences that fits goes first
      for (let k = g.length - 1; k >= 1; k--) {
        const head = g.slice(0, k)
        if (
          await fit(
            head.flatMap((i) => S[i].words.map((w) => w.text)),
            breaks(head),
          )
        ) {
          await place(head)
          await place(g.slice(k))
          return
        }
      }
    }
    for (const g of groups) await place(g)
    Ln.blocks = blocks
  }
  return caps
}
function captionAt(caps, t, look, rtl, cuts = []) {
  let Ln = null
  for (const x of caps) if (x.show <= t + 1e-9) Ln = x
  if (!Ln || t > Ln.hide + 0.2) return ''
  // a bubble that closes on a cut (or shrinking into one) is gone on the cut's frame: its shrink
  // never plays over the next shot
  if (t >= Ln.hide - 1e-9 && cuts.some((c) => c >= Ln.hide - 1e-6 && c <= t + 1e-9)) return ''
  let k = 0
  for (let i = 1; i < Ln.blocks.length; i++) if (t >= Ln.blocks[i].start) k = i
  const bl = Ln.blocks[k]
  const uIn = t - Ln.show
  // it pops open (or, swapping in for the line before, only bumps), bumps on a new block, and
  // shrinks away after its hide time
  let s = Ln.swapIn
    ? uIn < 0.16
      ? 1 + 0.05 * Math.sin((uIn / 0.16) * Math.PI)
      : 1
    : uIn < 0.2
      ? 0.6 + 0.4 * EASE.outBack(uIn / 0.2)
      : 1
  if (k > 0 && t - bl.start < 0.16) s *= 1 + 0.05 * Math.sin(((t - bl.start) / 0.16) * Math.PI)
  if (t > Ln.hide) s *= 1 - EASE.in(clamp((t - Ln.hide) / 0.2))
  return FL.bubble(look, t, { block: bl, rtl, scale: s })
}
// ------------------------------------------------------------------ the voice script
// What a voicing session needs: every line, its text in each locale and the characters it bills.
export function voiceScript(film = FILM) {
  const chars = (s) => [...s].length
  const lines = film.lines.map((x) => ({
    id: x.id,
    beat: x.beat,
    modes: x.modes,
    note: x.note,
    text: x.text,
    chars: Object.fromEntries(LOCALES.map((l) => [l, chars(x.text[l])])),
  }))
  const totals = Object.fromEntries(
    LOCALES.map((l) => [l, lines.reduce((s, x) => s + x.chars[l], 0)]),
  )
  return {
    film: 'venus-intro',
    takes: 'voice/<lang>/<id>.wav + <id>.json (the ElevenLabs character alignment), one per line',
    check: film.check,
    lines,
    totals,
  }
}

// ------------------------------------------------------------------ the race's day windows
// A day's line timed by the silent clock, for buildScore (the window shows the day without words)
function silentVT(text) {
  const parts = sentences(text)
  let t = 0.05
  const sents = [],
    words = []
  parts.forEach((p, i) => {
    const d = silentSeconds(p.text)
    sents.push({ t0: t, t1: t + d, a: p.a, b: p.b, text: p.text, gapAfter: p.gapAfter })
    const toks = p.text.split(/\s+/).filter(Boolean)
    toks.forEach((w, j) =>
      words.push({ text: w, t0: t + (d * j) / toks.length, t1: t + (d * (j + 1)) / toks.length }),
    )
    t += d + (i < parts.length - 1 ? p.gapAfter : 0)
  })
  return { words, sents, purr: null, whisper: null, end: sents[sents.length - 1].t1 }
}
// When a day shows everything it ships: its number landed and a milestone's items popped in
// (lib/items.mjs popIn: R + 0.15, 0.32 s), its seat up (the bag beat), its outfit on and the poof
// that brought it gone. A one-second window that starts any earlier spends itself on the entrance.
function settledAt(sc, IT) {
  const first = (p, ok) => (sc.keys[p] || []).find(([t, v]) => t > 0 && ok(v))?.[0]
  let t = sc.R + 0.5
  const bag = IT.seat && IT.seatMode !== 'always' ? first('bag', (v) => v >= 1) : undefined
  if (bag !== undefined) t = Math.max(t, bag + 0.12)
  const outfit = first('outfit', (v) => !!v)
  if (outfit !== undefined) t = Math.max(t, outfit + 0.1)
  if (sc.fx.poof !== null && sc.fx.poof !== undefined) t = Math.max(t, sc.fx.poof + 0.4)
  return t
}
// How small she must be drawn (about the ground line, as render.mjs fitUnderLabel draws a day) so
// her highest point stays LABEL_CLEAR px under the full-size number's label in every probed frame.
// probes: [{ fig (rig units, the ground at 0), z, lift }]; only what is under the label counts (hw:
// the label's half width on screen), so a balloon off to the side does not shrink her.
const LABEL_CLEAR = 10
async function labelFit(B, probes, line, hw) {
  if (!probes.length) return 1
  const half = Math.ceil(hw / (BASE * Math.min(...probes.map((p) => p.z))))
  const tops = await B.tops(
    probes.map((p) => p.fig),
    [-half, -2600, 2 * half, 2800],
  )
  let fit = 1
  probes.forEach((p, i) => {
    const D = HEAD_H * (p.z - 1) + tops[i] * p.z // her top above the ground at fit 1, rig units
    if (D < 0) fit = Math.min(fit, (G - p.lift - line - LABEL_CLEAR) / (-BASE * D))
  })
  return Math.floor(fit * 1000) / 1000
}
const labelHalf = (labelW) => Math.min(labelW, 820) / 2 + 12
// One window of the race: the day as it ships (its plan, look, items, number), scored without its
// line. A short window opens on the day already settled (settledAt): everything it ships is on, and
// its number pops on the cut. The bag days open with the bag already under her (each "Bag." lands
// with its bag, on the cut, to a crinkle), except the one whose bag lands on a line ("…Different
// bag."); day 100 opens on the frame its slammed number hits, so the cut, the music's return, the
// thud and the shake are one frame.
async function dayWindow(B, w, ctx) {
  const { W, lang, ec, endStyle } = ctx
  let plan = planVideo(w.day, lang)
  if (w.align === 'slam') plan = { ...plan, reveal: 'slam' }
  const sc = buildScore(plan, silentVT(plan.quip.text), { endStyle })
  const A = { env: [], bright: [] }
  const label = streakLabel(plan.day, lang)
  const labelW = (await B.measure([label], `900 54px ${L.FONT}`))[0] + 6 * [...label].length
  const cap = { blocks: [], rtl: isRTL(lang), labelW }
  const fit = await fitUnderLabel(B, plan, sc, A, cap, ec, endStyle, null)
  const T0 = W(w.from),
    T1 = W(w.runOn ?? w.to)
  let start
  // the slam's number falls for 0.13 s and hits (layers.mjs number, score.mjs reveal)
  const SLAM_HIT = 0.13
  if (w.align === 'R') start = settledAt(sc, itemsFor(plan))
  else if (w.align === 'slam') start = sc.R + SLAM_HIT
  else {
    const bagAt = sc.T.v - 0.3 + 0.28 // bag-throne: the bag pops at m0 + 0.28, full 0.16 s later
    if (w.on) start = bagAt - (ctx.clock.lines[w.on[0]].sents[w.on[1]].t0 + 0.1 - T0)
    else start = bagAt + 0.17
  }
  start = Math.round(start * FPS) / FPS
  // the number stays full size through a window (its badge would start mid-race), except on the
  // bag days, whose bag arrives under the badge; and no day's own flash (the house 55% wash) gets in.
  // On a bag day the camera pulls back (the zoom keeps her face where it is) and tilts down: the
  // film's line sits where the day has none, and the bag is the joke, so it has to clear the bubble.
  const bag = w.align === 'bag'
  const scX = {
    ...sc,
    // a short window's number is already the day's: it pops on the cut, no count from N - 1
    num: w.align === 'R' ? { ...sc.num, at: start - 2 / FPS, mode: 'pop' } : sc.num,
    fx: { ...sc.fx, flashes: [] },
    T: bag ? sc.T : { ...sc.T, v: 1e9 },
    cam: bag
      ? {
          ...sc.cam,
          z: sc.cam.z.map(([t, v, ...e]) => [t, v * BAG_CAM.z, ...e]),
          lift: (sc.cam.lift || [[0, 0]]).map(([t, v, ...e]) => [t, v + BAG_CAM.lift, ...e]),
        }
      : sc.cam,
  }
  const f0 = Math.round(T0 * FPS),
    f1 = Math.round(T1 * FPS)
  const local = (f) => start + (f - f0) / FPS
  // the number stays full size through the window, so she is drawn small enough that her ears
  // stay under its label in every frame of it (the day itself only needs that while it lands)
  const probeAt = []
  for (let f = f0; f < f1; f += 2) probeAt.push(local(f))
  const probes = frameSvgs(plan, scX, A, cap, ec, endStyle, { at: probeAt, probe: true }).map(
    (p) => ({
      fig: p.fig,
      z: L.trk(scX.cam.z, p.t),
      lift: scX.cam.lift ? L.trk(scX.cam.lift, p.t) : 0,
    }),
  )
  const winFit = Math.min(
    fit,
    await labelFit(B, probes, L.labelBottom(formatNumber(plan.day, lang)), labelHalf(labelW)),
  )
  const len = W(w.to) - T0
  const sfx = []
  // day 100's confetti burst at the reveal, a frame or four before the hit the window opens on,
  // still sounds (on the cut); the slam's fall (its whoosh) is not in the picture, so not in the mix
  const early = w.align === 'slam' ? SLAM_HIT + 0.02 : 0.02
  for (const s of sc.sfx) {
    if (s.kind === 'shutter' || (w.align === 'slam' && s.kind === 'whoosh')) continue
    if (s.kind === 'counter') {
      const ticks = s.ticks
        .filter(([t]) => t >= start && t < start + len)
        .map(([t, k]) => [t - start + T0, k])
      if (ticks.length) sfx.push({ ...s, ticks, gainDb: (s.gainDb ?? 0) - 4 })
    } else if (s.at >= start - early && s.at < start + len)
      sfx.push({ ...s, at: Math.max(T0, s.at - start + T0), gainDb: (s.gainDb ?? 0) - 4 })
  }
  // the bag lands before the window: its crinkle comes on the cut
  if (bag && !w.on) sfx.push({ kind: 'crinkle', at: T0, gainDb: -7 })
  return {
    plan,
    look: plan.look,
    start,
    fit: winFit,
    f0,
    f1,
    sfx,
    // the day's own frames, drawn by its own renderer, for the film frames asked for: a few either
    // side of the window too, for the swipes that bring it in and take it away
    svgs(frames) {
      const want = frames.filter((f) => f >= f0 - SWIPE_F && f < f1 + SWIPE_F)
      const m = new Map()
      if (!want.length) return m
      const out = frameSvgs(plan, scX, A, cap, ec, endStyle, { at: want.map(local), fit: winFit })
      for (const x of out)
        m.set(
          f0 + Math.round((x.t - start) * FPS),
          x.svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, ''),
        )
      return m
    },
  }
}

// ------------------------------------------------------------------ pictures by reference
// This locale's published day covers, squared on her face and the number (y 250..1330), and a
// frosted copy of each, in cache/intro-covers/<lang>/ (downloaded once, read only)
async function wallTiles(lang, log) {
  const dir = path.join(CACHE, 'intro-covers', lang)
  fs.mkdirSync(dir, { recursive: true })
  const out = {},
    missing = []
  for (let d = 1; d <= 100; d++) {
    out[d] = { tc: path.join(dir, `tile-${d}.jpg`), tf: path.join(dir, `frost-${d}.jpg`) }
    if (!fs.existsSync(out[d].tc) || !fs.existsSync(out[d].tf)) missing.push(d)
  }
  if (missing.length) log(`  ${lang}: fetching ${missing.length} day covers for the wall`)
  const magick = (args, input) => execFileSync('magick', args, input ? { input } : undefined)
  // the CDN answers a burst with the odd 5xx: a few tries, a little apart
  const get = async (url) => {
    for (let k = 0; ; k++) {
      const r = await fetch(url)
      if (r.ok) return Buffer.from(await r.arrayBuffer())
      if (k === 3 || r.status < 500) throw new Error(`${url}: ${r.status}`)
      await new Promise((ok) => setTimeout(ok, 800 * (k + 1)))
    }
  }
  // The downloaded cover goes straight into magick on stdin and only the tiles are kept: nothing
  // fetched is written to disk by this process, so there is no check-then-write to race either.
  const cover = async (d) => {
    try {
      const jpg = await get(coverUrl(lang, d))
      if (!isJpeg(jpg)) throw new Error(`${coverUrl(lang, d)}: not a JPEG`)
      return jpg
    } catch (e) {
      // a cover the CDN keeps refusing is also the video's attached picture
      log(`  ${lang}: ${e.message}; taking day ${d}'s cover from its video`)
      // the attached picture as it is stored (stream copy), on stdout
      const jpg = execFileSync(
        'ffmpeg',
        [
          ...['-hide_banner', '-loglevel', 'error', '-i', coverUrl(lang, d, 'mp4')],
          ...['-map', '0:v:1', '-c', 'copy', '-frames:v', '1', '-f', 'image2pipe', 'pipe:1'],
        ],
        { stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 64 << 20 },
      )
      if (!isJpeg(jpg)) throw new Error(`day ${d}: the video's cover is not a JPEG`, { cause: e })
      return jpg
    }
  }
  for (let i = 0; i < missing.length; i += 6)
    await Promise.all(
      missing.slice(i, i + 6).map(async (d) => {
        const jpg = await cover(d)
        magick(
          [
            'jpeg:-',
            '-crop',
            '1080x1080+0+250',
            '+repage',
            '-resize',
            '256x256',
            '-quality',
            '86',
            out[d].tc,
          ],
          jpg,
        )
        magick([out[d].tc, '-blur', '0x9', '-modulate', '100,55', '-quality', '80', out[d].tf])
      }),
    )
  return out
}
const dataUri = (file, type) => `data:${type};base64,${fs.readFileSync(file).toString('base64')}`
// the <defs> a run of frames needs (frames.mjs puts them on each page once)
function defsFor(keys, ctx) {
  const img = (id, file, type, w) =>
    `<image id="${id}" href="${dataUri(file, type)}" width="${w}" height="${w}"/>`
  const tile = (d) =>
    img(`tc-${d}`, ctx.tiles[d].tc, 'image/jpeg', 256) +
    img(`tf-${d}`, ctx.tiles[d].tf, 'image/jpeg', 256)
  const st = (name) => img(`st-${name}`, path.join(STICKERS, `${name}.webp`), 'image/webp', 384)
  let s = ''
  for (const k of keys)
    if (k === 'tiles') for (let d = 1; d <= 100; d++) s += tile(d)
    else if (k === 'tile31') s += tile(31)
    else if (k === 'hellos') for (const l of LOCALES) s += st(HELLO[l])
    else s += st(k)
  return s
}

// ------------------------------------------------------------------ the film
export async function buildFilm({
  lang,
  B,
  voiceDir = VOICE_DIR,
  endStyle = 'handoff',
  log = console.log,
}) {
  const clock = buildClock(lang, { voiceDir })
  const W = clock.W
  const rtl = isRTL(lang)
  const shots = placeShots(clock, lang)
  const endAt = W(END_BOARD),
    duration = shots[shots.length - 1].T1,
    n = Math.round(duration * FPS)
  // the joins a bubble treats as cuts: a whole new picture (the race's swipes, the dolly out of day
  // 100). Across a poof, a flat or the match it is the same place, and the bubble stays up.
  const cuts = shots.filter((s) => s.tx === 'swipe' || s.tx === 'dolly').map((s) => s.T0)
  const caps = await layoutCaptions(B, clock, cuts, lang)
  // the backdrop flats and the stage's bursts, in film time
  const flats = FLATS.map(([b, look, kind]) => [W(b), look, kind])
  const bursts = BURSTS.map(([a, b]) => [W(a), W(b)])
  // the header text, measured in the browser that draws it
  const [w100] = await B.measure(['VENUS'], `900 100px Nunito`)
  const titleF = Math.min(230, Math.floor(800 / (w100 / 100 - 0.15)))
  const pillLay = async (text, steps, maxW, maxLines) => {
    for (const F of steps) {
      const ws = text.split(' ')
      const r = await B.measure([...ws, ' '], `900 ${F}px ${FL.FILM_FONT}`)
      // the widths keyed by word, built from entries rather than by assignment: a word is data,
      // and fromEntries makes even "__proto__" an own key instead of calling the prototype setter
      const m = Object.fromEntries([
        ...ws.map((w, i) => [w, r[i] + F * 0.04 * [...w].length]),
        [' ', r[r.length - 1]],
      ])
      const lines = FL.wrap(ws, m, maxW - 1.24 * F, maxLines)
      if (lines) {
        const txt = lines.map((l) => l.join(' '))
        const ww = await B.measure(txt, `900 ${F}px ${FL.FILM_FONT}`)
        return { F, lines: txt, w: ww.map((x, i) => x + F * 0.04 * [...txt[i]].length) }
      }
    }
    throw new Error(`"${text}" does not fit its pill`)
  }
  const tagline = await pillLay(
    FILM.screen.tagline[lang].toLocaleUpperCase(lang),
    [56, 48, 42, 36],
    790,
    2,
  )
  const free = await pillLay(FILM.screen.free[lang], [56, 48], 600, 1)
  const one = streakLabel(1, lang)
  const oneW = (await B.measure([one], `900 54px ${FL.FILM_FONT}`))[0] + 6 * [...one].length
  const pillH =
    tagline.lines.length * Math.round(tagline.F * 1.18) + 2 * Math.round(tagline.F * 0.34)
  const F = {
    rtl,
    titleF,
    tagline,
    // under the title, clear of its outline
    taglineY: FL.TITLE_Y + titleF * 0.35 + 40 + pillH / 2,
    taglineBottom: FL.TITLE_Y + titleF * 0.35 + 40 + pillH,
    free,
    counter: (v, at) => ({
      at,
      mode: 'pop',
      text: formatNumber(v, lang),
      label: one,
      labelW: oneW,
      rtl,
      font: FL.FILM_FONT,
      value: v,
    }),
  }
  const ec = await EC.prepare(B, lang)
  const tiles = await wallTiles(lang, log)
  const ctx = { W, lang, rtl, clock, ec, endStyle, tiles }
  // the mouth: on-camera and whispered sentences only, from a take's own loudness when there is one
  const env = new Float32Array(n),
    bright = new Float32Array(n).fill(0.5),
    soft = new Float32Array(n).fill(1)
  for (const Ln of Object.values(clock.lines)) {
    const A = Ln.take ? analyseVoice(Ln.take.wav, Ln.text, FPS) : null
    for (const s of Ln.sents) {
      if (s.mode === 'vo') continue
      if (A) {
        const f1 = Math.ceil((s.t0 + s.take.to - s.take.from) * FPS)
        for (let f = Math.floor(s.t0 * FPS); f <= f1 && f < n; f++) {
          const vf = Math.round((f / FPS - s.t0 + s.take.from) * FPS)
          if (vf >= 0 && vf < A.env.length && A.env[vf] > env[f]) {
            env[f] = A.env[vf]
            bright[f] = A.bright[vf] ?? 0.5
          }
        }
      } else syntheticMouth(s.words, FPS, n, env, bright)
      if (s.mode === 'whisper')
        for (let f = Math.floor(s.t0 * FPS) - 3; f <= Math.ceil(s.t1 * FPS) + 3 && f < n; f++)
          soft[f] = 0.55
    }
  }
  // her shots: one animator each; their sounds in film time
  const sfx = []
  for (const sh of shots) {
    if (sh.day || sh.wall) continue
    const S = shotClock(sh, clock)
    S.pillBottom = F.taglineBottom
    if (sh.id === 'bonk') Object.assign(S, await bonkTop(B, sh, S))
    // a shot with a counter: small enough that her ears stay under its label once it is up
    const fit = sh.labelAt !== undefined ? await shotLabelFit(B, sh, S, F) : 1
    Object.assign(sh, performShot(sh, S), { fit })
    for (const x of sh.c.sfx) {
      const at = x.at - sh.off + sh.T0
      if (at >= sh.T0 - 0.05 && at < sh.T1) sfx.push({ ...x, at })
    }
  }
  // the poof over every poof join: centred on her body as the incoming shot frames it, a soft pop
  const joinPoofs = shots
    .filter((sh) => sh.tx === 'poof')
    .map((sh) => {
      const ta = sh.off
      const z = L.trk(sh.cam.z, ta),
        s = BASE * z
      const cy = G + HEAD_H * BASE * (z - 1) - (sh.cam.lift ? L.trk(sh.cam.lift, ta) : 0)
      sfx.push({ kind: 'pop', at: sh.T0 - 0.02, gainDb: -10 })
      // over her whole sitting figure, ears to paws (she is about 520 px tall at zoom 1)
      return {
        T0: sh.T0,
        x: 540 + (sh.cam.dx ? L.trk(sh.cam.dx, ta) : 0),
        y: cy - 270 * s,
        k: 1.9 * z,
      }
    })
  // the race, and the wall it dollies out to
  for (const sh of shots.filter((s) => s.day)) {
    Object.assign(sh, await dayWindow(B, sh, ctx))
    sfx.push(...sh.sfx)
  }
  // day 100's slam is anchor B: the sting on the downbeat, with the score's crash
  sfx.push({ kind: 'sting', at: clock.anchors.B, gainDb: -3 }, ...wallSfx(clock))
  // a flat moving is heard, just: a soft whoosh
  for (const [t, , kind] of flats)
    if (kind !== 'set') sfx.push({ kind: 'whoosh', at: t, gainDb: -16 })
  sfx.push(...EC.endSfx(endStyle, endAt))
  const bonk = shots.find((s) => s.id === 'bonk')
  const film = {
    lang,
    rtl,
    clock,
    W,
    caps,
    shots,
    cuts,
    flats,
    bursts,
    joinPoofs,
    F,
    ctx,
    env,
    bright,
    soft,
    sfx,
    endAt,
    duration,
    n,
    endStyle,
    scene0: '',
    // the bonk in film time, and the floor its first frame stands on (the wall's push settles on it)
    bonkHit: bonk.c.bonk - bonk.off + bonk.T0,
    bonkCy: G + HEAD_H * BASE * (BONK_CAM.z - 1) - BONK_CAM.lift,
  }
  return film
}
// The bonk: on the leap's last frame (the hit) her top meets the locked frame's bottom edge, and
// from the next one, crumpled against it and turning to the lens, she is held there (pin) until she
// slides. Rise only moves her up and down, so one drawing at a trial height, measured (as
// fitUnderLabel measures her), gives the height of every one of those frames exactly.
async function bonkTop(B, sh, S) {
  const { back } = bonkClock(S)
  const z = BONK_CAM.z,
    s = BASE * z,
    cy = G + HEAD_H * BASE * (z - 1) - BONK_CAM.lift
  const want = (BONK_FRAME[1] + BONK_FRAME[2] - 4 - cy) / s // rig units, the ground at 0
  const hitF = Math.round(back * FPS) - 1,
    n = Math.round(0.26 * FPS)
  const trial = 300
  const times = Array.from({ length: n + 1 }, (_, i) => r3(back + i / FPS))
  const { anim } = performShot(sh, { ...S, top: trial, pin: times.map((t) => [t, trial]) })
  const frags = []
  for (let f = 0; f <= hitF + n + 1; f++) {
    const P = anim.at(f)
    if (f >= hitF) frags.push(V.draw(P))
  }
  const tops = await B.tops(frags, [-700, -2600, 1400, 2800])
  return {
    top: Math.round(trial + (tops[0] - want)),
    pin: times.map((t, i) => [t, Math.round(trial + (tops[i + 1] - want))]),
  }
}
async function shotLabelFit(B, sh, S, F) {
  const { anim, cam } = performShot(sh, { ...S })
  const from = Math.round(S.at(sh.labelAt) * FPS),
    to = Math.round(S.len * FPS)
  const probes = []
  for (let f = 0; f < to; f++) {
    const P = anim.at(f)
    if (f < from || (f - from) % 2) continue
    const ta = f / FPS
    probes.push({ fig: V.draw(P), z: L.trk(cam.z, ta), lift: cam.lift ? L.trk(cam.lift, ta) : 0 })
  }
  return labelFit(
    B,
    probes,
    L.labelBottom(formatNumber(1, sh.lang)),
    labelHalf(F.counter(1, 0).labelW),
  )
}
function wallSfx(clock) {
  const W = clock.W
  const a = W(WALL_TIMES.a),
    b = W(WALL_TIMES.b)
  const ticks = []
  for (let i = 1; i <= 99; i++) ticks.push([a + ((i - 1) / 99) * (b - a) * 0.92, i / 99])
  return [
    { kind: 'counter', ticks, gainDb: -9 },
    { kind: 'sparkle', at: W(WALL_TIMES.glint), gainDb: -7 },
    { kind: 'blip', at: clock.lines['intro-15'].sents[1].t0, gainDb: -6 },
    { kind: 'whoosh', at: W(WALL_TIMES.push), gainDb: -6 },
  ]
}

// ------------------------------------------------------------------ one frame
const shotAt = (film, t) =>
  film.shots.find((s) => t >= s.T0 - 1e-9 && t < s.T1 - 1e-9) || film.shots[film.shots.length - 1]
// a swipe takes 0.24 s, centred on its join
const SWIPE = 0.24,
  SWIPE_F = Math.ceil((SWIPE / 2) * FPS) + 1
// The backdrop behind her at film time t: the stage (its floor always under her), and the flats up
// over it, clipped to above the floor line. The look on top sets the bubble's shadow.
function backdrop(film, t, cy) {
  const floorY = cy - 80
  const flats = FL.flatsAt(t, film.flats, Math.max(1500, floorY + 20))
  let s = FL.stageGround(t, cy, film.bursts)
  flats.forEach((fl, i) => {
    const content =
      fl.look === 'wall'
        ? wallFlat(film, t)
        : L.LOOKS[fl.look].bg(t, cy, { seed: 7, numAt: Infinity })
    s += FL.flat(content, fl.dy, floorY, `fl${i}`)
  })
  let look = 'stage'
  for (const fl of flats) if (floorY + fl.dy > floorY / 2 && fl.look !== 'wall') look = fl.look
  return { s, flats, look }
}
// Her, in one of her shots, at film frame f, in the parts the end card and the photo print need:
// under (the backdrop and what stands behind her), fig, over (effects), flash, top (titles, stickers)
function drawShot(film, sh, f) {
  const t = f / FPS,
    ta = t - sh.T0 + sh.off
  const S = sh.S,
    c = sh.c
  const P = sh.anim.at(Math.max(0, Math.round(ta * FPS)))
  // lip sync (render.mjs's): loudness opens the mouth, brightness widens it
  const e = film.env[f]
  if (e > 0) {
    const k = film.soft[f]
    if (!(P.mouth.tongue > 0.3)) {
      P.mouth.open = Math.max(P.mouth.open * 0.5, e * 0.82 * k)
      P.mouth.wide = (P.mouth.wide ?? 1) * (0.72 + 0.55 * film.bright[f])
    }
    P.head.pitch += 3.5 * e * k
  }
  // what she wears from now on
  let idx = -1
  for (let i = 0; i < sh.items.length; i++) if (ta >= sh.items[i][0]) idx = i
  if (!sh.IT || idx !== sh.itemsAt) {
    sh.IT = {
      day: 0,
      lang: film.lang,
      seat: null,
      wear: null,
      neck: null,
      prop: null,
      air: null,
      seatMode: null,
      side: 1,
      ids: [],
    }
    for (let i = 0; i <= idx; i++) Object.assign(sh.IT, sh.items[i][1])
    sh.itemsAt = idx
  }
  const IT = sh.IT
  // items.mjs times its interactions on a day's score; the film's shots have none
  const fake = {
    R: -1,
    T: { sents: [{ t0: 1e9, t1: 1e9 }], v: 1e9, e: 1e9 },
    blink: 1e9,
    endAt: 1e9,
  }
  applyItemPose(IT, ta, P, fake)
  // the camera: the zoom keeps her face where it is on screen
  const cam = sh.cam
  let z = L.trk(cam.z, ta)
  for (const b of cam.bumps)
    if (ta >= b && ta < b + 0.35) z *= 1 + 0.06 * Math.sin(((ta - b) / 0.35) * Math.PI)
  // a shot with a counter has her small enough for its label: she eases to that size over the 0.4 s
  // before it pops, not from the shot's first frame
  const fit =
    sh.fit === undefined || sh.fit >= 1
      ? 1
      : 1 + (sh.fit - 1) * EASE.inOut(clamp((ta - (S.at(sh.labelAt) - 0.4)) / 0.4))
  const s = BASE * z * fit
  let cx = 540 + (cam.dx ? L.trk(cam.dx, ta) : 0),
    cy = G + HEAD_H * BASE * fit * (z - 1) - (cam.lift ? L.trk(cam.lift, ta) : 0)
  for (const sk of cam.shakes) {
    const u = ta - sk
    if (u >= 0 && u < 0.3) {
      const a = 11 * Math.exp(-u * 12)
      cx += Math.sin(ta * 97) * a
      cy += Math.cos(ta * 83) * a
    }
  }
  const bd = backdrop(film, t, cy)
  let top = sh.over ? sh.over(ta, S, film.F, t, bd.flats) : '',
    freeze = null
  if (top && typeof top === 'object') ({ s: top, freeze } = top)
  let body = itemLayers(IT, ta, P, V.draw(P), fake)
  const MP = c.fx.props
  if (MP.length)
    body = L.moveProps(MP, ta, P, V, 'back') + body + L.moveProps(MP, ta, P, V, 'front')
  const fig = `<g transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)}) scale(${s.toFixed(4)})">${body}</g>`
  const hx = cx + P.x * s,
    hy = cy - HEAD_H * s
  let over = ''
  if (c.fx.ledge && P.y > 30) over += L.ledge('stage', cy)
  for (const im of c.fx.impacts) over += L.impact(ta, im, cx, cy)
  for (const sp of c.fx.sparkles) over += L.sparkles(ta, sp[0], sp[1], sp[2], 7)
  for (const p of c.poofs || [])
    over += p.big
      ? L.poof(ta, p.t, cx, cy - 200 * s)
      : p.at === 'head'
        ? FL.quickPoof(ta, p.t, hx, hy - 40 * s)
        : p.at === 'feet'
          ? FL.quickPoof(ta, p.t, cx + P.x * s - 150 * s, cy - 20 * s, 0.35, 0.38)
          : p.at === 'seat'
            ? FL.quickPoof(ta, p.t, cx + P.x * s, cy - 50 * s, 0.3, 0.8)
            : FL.quickPoof(ta, p.t, cx, cy - 200 * s)
  const flash = c.fx.flashes.length ? L.flashes(ta, c.fx.flashes, { wash: 0.2 }) : ''
  return { under: bd.s, look: bd.look, fig, over, flash, top, freeze, ta, hx, hy, cx, cy }
}
// The wall at film time t, as it stands before any push: the dimmed stage, the covers rippling in,
// the live day-100 frame (d100: its svg, while the dolly lasts) shrinking into its tile, the glint,
// the frost and the locks. skip: a tile not to draw (the bonk's locked frame stands in for it).
function wallBody(film, t, d100, skip = 0) {
  const { W, rtl, clock } = film.ctx
  const a = W(WALL_TIMES.a),
    b = W(WALL_TIMES.b)
  let s =
    L.ground('stage', t, G, { numAt: Infinity, seed: 7 }) +
    `<rect width="${L.W}" height="${L.H}" fill="${L.INK}" opacity="0.5"/>`
  const glintAt = W(WALL_TIMES.glint),
    lockAt = clock.lines['intro-15'].sents[1].t0
  for (let i = 1; i <= 100; i++) {
    if ((i === 100 && t < b) || i === skip) continue
    const pop = i === 100 ? 1 : clamp((t - (a + ((i - 1) / 99) * (b - a) * 0.92)) / 0.16)
    const glint = i <= 30 ? (t - (glintAt + (i - 1) * 0.025)) / 0.35 : -1
    const frost = i > 30 ? clamp((t - (lockAt + ((i - 31) / 69) * 0.6)) / 0.3) : 0
    s += FL.tile(i, FL.tileRect(i, rtl), { pop, frost, glint })
  }
  if (t < b && d100) {
    // an exponential zoom (no sideways drift) from the whole frame to the tile, the crop closing
    // from 1080x1920 to the tile's square (y 250..1330, the covers' own crop) as it goes
    const [tx, ty, tw] = FL.tileRect(100, rtl)
    const v = EASE.inOut(clamp((t - a) / (b - a)))
    const w = Math.exp(Math.log(1080) + (Math.log(tw) - Math.log(1080)) * v)
    const q = (1080 - w) / (1080 - tw),
      k = w / 1080
    const y0 = 250 * q,
      h = 1920 - 840 * q,
      rx = (10 * q) / k
    const border =
      q > 0.5
        ? `<rect x="0" y="${r3(y0)}" width="1080" height="${r3(h)}" rx="${r3(rx)}" fill="none" stroke="#ffffff" stroke-width="${r3(3 / k)}" opacity="${r3((q - 0.5) * 2)}"/>`
        : ''
    s += `<g transform="translate(${r3(tx * q)} ${r3(ty * q - y0 * k)}) scale(${r3(k)})"><clipPath id="dly"><rect x="0" y="${r3(y0)}" width="1080" height="${r3(h)}" rx="${r3(rx)}"/></clipPath><g clip-path="url(#dly)">${d100}</g>${border}</g>`
  }
  if (t >= glintAt) {
    const [gx, gy] = FL.tileRect(rtl ? 10 : 1, rtl)
    s += L.sparkles(t, glintAt, rtl ? gx - 374 : gx + 460, gy + 130, 11, 7, 420)
  }
  return s
}
// the push into tile 31, v 0..1: one exponential zoom that lands the tile on BONK_FRAME
function wallPushed(film, s, v) {
  const [tx, ty, tw] = FL.tileRect(31, film.rtl)
  const [X1, Y1, W1] = BONK_FRAME
  const kEnd = W1 / tw,
    k = Math.exp(Math.log(kEnd) * v),
    q = (k - 1) / (kEnd - 1)
  return `<g transform="translate(${r3(tx + (X1 - tx) * q - tx * k)} ${r3(ty + (Y1 - ty) * q - ty * k)}) scale(${r3(k)})">${s}</g>`
}
// The wall, at film frame f. Its last move is the push into tile 31, eased in and out so it settles
// on the bonk's framing; while it settles the stage floor comes up under it (the wall becomes the
// bonk's backdrop flat) and the big locked frame fades in over the tile, so the match into the bonk
// changes nothing on screen.
function drawWall(film, sh, f, d100) {
  const t = f / FPS
  const s = wallBody(film, t, d100)
  const p0 = film.W(WALL_TIMES.push)
  if (t <= p0) return s
  const v = EASE.inOut(clamp((t - p0) / (sh.T1 - p0)))
  const floorY = film.bonkCy - 80
  let out =
    FL.stageGround(t, film.bonkCy, film.bursts) +
    FL.flat(wallPushed(film, s, v), 0, L.H - (L.H - floorY) * v, 'wfl')
  const k = clamp((t - (sh.T1 - 0.3)) / 0.3)
  if (k > 0) out += `<g opacity="${r3(k)}">${FL.lockedFrame(31, ...BONK_FRAME)}</g>`
  return out
}
// The wall as the bonk's backdrop: held as the push left it, tile 31 drawn as the big locked frame,
// which rattles when she hits it
function wallFlat(film, t) {
  if (!film.wallFrozen) {
    const wall = film.shots.find((s) => s.wall)
    film.wallFrozen = wallPushed(film, wallBody(film, wall.T1, null, 31), 1)
  }
  const u = t - film.bonkHit
  const rot = u > 0 && u < 0.6 ? 3.5 * Math.sin(u * 40) * Math.exp(-u * 6) : 0
  const [x, y, w] = BONK_FRAME
  return (
    film.wallFrozen +
    `<g transform="rotate(${r3(rot)} ${x + w / 2} ${y})">${FL.lockedFrame(31, x, y, w)}</g>`
  )
}
// One shot's picture at film frame f (the days' from dayCache), with the end card over the last
function sceneOf(film, sh, f, dayCache) {
  const t = f / FPS
  if (sh.day) return { scene: dayCache.get(`${sh.id}:${f}`) ?? '', look: sh.look, E: null }
  if (sh.wall)
    return { scene: drawWall(film, sh, f, dayCache.get(`d100:${f}`)), look: 'stage', E: null }
  const d = drawShot(film, sh, f)
  let E = null
  if (sh === film.shots[film.shots.length - 1] && t >= film.endAt && f > 0)
    E = EC.frame(film.endStyle, {
      u: t - film.endAt,
      t,
      hx: d.hx,
      hy: d.hy,
      cx: d.cx,
      cy: d.cy,
      V,
      ec: film.ctx.ec,
      scene0: film.scene0,
    })
  const fig = E && E.fig ? `<g transform="${E.fig}">${d.fig}</g>` : d.fig
  let scene = E && E.cover ? '' : d.under + fig + d.over + d.flash + d.top
  // the photo booth: the frame freezes into a print (without the flash that took it), which then
  // flies to its sticker over the live picture
  if (d.freeze && d.ta >= d.freeze.at - 1e-6 && d.ta < d.freeze.flyEnd + 0.01) {
    const fr = d.freeze
    if (!sh.frozen) sh.frozen = d.under + d.fig + d.over
    const print = FL.print(d.ta, {
      scene: sh.frozen,
      rect: PRINT,
      freezeAt: fr.at,
      flyAt: fr.live,
      flyEnd: fr.flyEnd,
      to: { x: BLEP_HERO[0], y: BLEP_HERO[1], size: BLEP_HERO[2], rot: BLEP_HERO[3] },
      id: 'st-blep',
    })
    // the bubble stays above the print, and above the dim while it lifts
    scene = d.ta < fr.live ? print + d.top : d.under + fig + d.over + d.flash + print + d.top
  }
  return { scene, look: d.look, E }
}
// Two pictures in one frame (a swipe) must not share ids: the incoming one's are renamed
function prefixIds(svg, p) {
  const ids = new Set([...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]))
  if (!ids.size) return svg
  const ref = (m, pre, id, post) => (ids.has(id) ? `${pre}${p}-${id}${post}` : m)
  return svg
    .replace(/\bid="([^"]+)"/g, (m, id) => `id="${p}-${id}"`)
    .replace(/(url\(#)([^)]+)(\))/g, ref)
    .replace(/(href="#)([^"]+)(")/g, ref)
}
function frameSvg(film, f, dayCache, { cover = false } = {}) {
  const t = f / FPS
  const sh = shotAt(film, t)
  let { scene, look, E } = sceneOf(film, sh, f, dayCache)
  // a swipe: the old picture slides up and away as the new one comes in from below
  const k = film.shots.findIndex(
    (s, i) => i > 0 && s.tx === 'swipe' && Math.abs(t - s.T0) < SWIPE / 2 - 1e-9,
  )
  if (k > 0) {
    const inc = film.shots[k],
      before = sh !== inc
    const other = sceneOf(film, before ? inc : film.shots[k - 1], f, dayCache).scene
    const [a, b] = before ? [scene, other] : [other, scene]
    const u = EASE.inOut(clamp((t - (inc.T0 - SWIPE / 2)) / SWIPE))
    scene = `<g transform="translate(0 ${r3(-u * L.H)})">${a}</g><g transform="translate(0 ${r3((1 - u) * L.H)})">${prefixIds(b, 'sw')}</g>`
  }
  // the poof over a poof join
  for (const p of film.joinPoofs) scene += FL.bigPoof(t, p.T0, p.x, p.y, p.k)
  if (f === 0) film.scene0 = scene
  let body = scene
  if (cover) body += EC.badge(540, 1790, 44)
  else if (!(E && E.cover)) body += captionAt(film.caps, t, look, film.rtl, film.cuts)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${L.W}" height="${L.H}" viewBox="0 0 ${L.W} ${L.H}">${body}${E ? E.over : ''}</svg>`
}

// ------------------------------------------------------------------ sound
// The music is one score for the whole film (lib/film-score.mjs): one key, one tempo, one bar grid,
// every section at one loudness and nothing ever stopping. It sits at one gain under her voice from
// the first frame to the last. The first cut ducked it under every line and laid a new bed at every
// cut, and the music rose and fell every few seconds: the film sounded like separate pieces.
const musicStem = (film, out) =>
  renderScore(planScore(film.clock, { endAt: film.endAt, duration: film.duration }), out)
// K-weighting at 48 kHz (BS.1770: the shelf, then the high-pass), as [b0, b1, b2, a1, a2]
const KW = [
  [1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585],
  [1, -2, 1, -1.99004745483398, 0.99007225036621],
]
// One sentence's level in dB: K-weighted 50 ms blocks, the ones within 15 dB of its loudest
// (so the silence at a window's edges does not count), power-averaged.
function activeLevel(x, from, to) {
  let y = x.subarray(Math.max(0, Math.round(from * 48000)), Math.round(to * 48000))
  for (const [b0, b1, b2, a1, a2] of KW) {
    const o = new Float32Array(y.length)
    let x1 = 0,
      x2 = 0,
      y1 = 0,
      y2 = 0
    for (let i = 0; i < y.length; i++) {
      o[i] = b0 * y[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
      x2 = x1
      x1 = y[i]
      y2 = y1
      y1 = o[i]
    }
    y = o
  }
  const B = Math.min(2400, y.length),
    e = []
  for (let i = 0; i + B <= y.length; i += B / 2) {
    let s = 0
    for (let j = i; j < i + B; j++) s += y[j] * y[j]
    e.push(s / B)
  }
  const top = Math.max(...e),
    on = e.filter((v) => v >= top / 10 ** 1.5)
  return 10 * Math.log10(on.reduce((a, v) => a + v, 0) / on.length + 1e-12)
}
// Each voiced sentence's lift in dB, keyed by the clock's sentence: up to the film's median
// sentence, never down. A [whispers] or [softly] take comes out 10-15 dB under her normal lines,
// and those lines sat level with the music and were lost under it. Worked out once per film.
function voiceLifts(film) {
  if (film.lifts) return film.lifts
  const level = new Map()
  for (const Ln of Object.values(film.clock.lines))
    if (Ln.take) {
      const x = decode(Ln.take.wav, { rate: 48000 })[0]
      for (const s of Ln.sents) level.set(s, activeLevel(x, s.take.from, s.take.to))
    }
  const sorted = [...level.values()].sort((a, b) => a - b)
  const target = sorted[Math.floor(sorted.length / 2)]
  film.lifts = new Map([...level].map(([s, l]) => [s, Math.max(0, target - l)]))
  return film.lifts
}
// The voice, when there are takes: each sentence of each take placed at its own time (the clock
// places sentences, not whole takes, so the board's gaps stay), at its lift. Null without takes.
// A sentence's window ends in the silence before the next one of its take, never past where that
// one's window opens: a pushed sentence plays apart from the next, so any overlap would be heard
// twice. Both edges fade, so a cut that still lands on sound is not a click.
function voiceStem(film, out) {
  const parts = []
  const lifts = voiceLifts(film)
  for (const Ln of Object.values(film.clock.lines))
    if (Ln.take) {
      const S = Ln.sents.map((s) => s.take)
      const pre = S.map((t, i) => Math.min(0.03, t.from, i ? (t.from - S[i - 1].to) / 2 : 0.03))
      S.forEach((t, i) =>
        parts.push({
          wav: Ln.take.wav,
          from: t.from - pre[i],
          to: Math.max(
            t.to,
            Math.min(t.to + 0.12, i < S.length - 1 ? S[i + 1].from - pre[i + 1] : Infinity),
          ),
          at: t.at - pre[i],
          lift: lifts.get(Ln.sents[i]),
        }),
      )
    }
  if (!parts.length) return null
  const chains = parts.map(
    (p, i) =>
      `[${i}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=mono,atrim=${r3(p.from)}:${r3(p.to)},asetpts=N/SR/TB,volume=${p.lift.toFixed(2)}dB,afade=t=in:d=0.01,afade=t=out:st=${r3(Math.max(0, p.to - p.from - 0.015))}:d=0.015,adelay=${Math.round(p.at * 1000)}:all=1[v${i}]`,
  )
  chains.push(
    `${parts.map((_, i) => `[v${i}]`).join('')}amix=inputs=${parts.length}:normalize=0:duration=longest[out]`,
  )
  ff([
    ...parts.flatMap((p) => ['-i', p.wav]),
    '-filter_complex',
    chains.join(';'),
    '-map',
    '[out]',
    '-ar',
    '48000',
    out,
  ])
  return out
}
// integrated loudness of the part of a file from a to b seconds
function spanLufs(file, a, b) {
  const out = ffStderr([
    ...['-i', file, '-af', `atrim=${r3(a)}:${r3(b)},ebur128=framelog=quiet`],
    ...['-f', 'null', '-'],
  ])
  return +out.slice(out.lastIndexOf('Summary:')).match(/I:\s+(-?[\d.]+) LUFS/)[1]
}
// Voice over music for each voiced sentence, in dB, as both reach the mix (gv, gm: their gains):
// K-weighted, over its active speech, 50 ms blocks within 20 dB of its loudest
function voiceOverMusic(film, voice, music, gv, gm) {
  const kw = (x) => {
    let y = x
    for (const [b0, b1, b2, a1, a2] of KW) {
      const o = new Float32Array(y.length)
      let x1 = 0,
        x2 = 0,
        y1 = 0,
        y2 = 0
      for (let i = 0; i < y.length; i++) {
        o[i] = b0 * y[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2 = x1
        x1 = y[i]
        y2 = y1
        y1 = o[i]
      }
      y = o
    }
    return y
  }
  const v = kw(decode(voice, { rate: 48000 })[0]),
    m = kw(decode(music, { rate: 48000 })[0])
  const rows = []
  for (const Ln of Object.values(film.clock.lines)) {
    if (!Ln.take) continue
    for (const s of Ln.sents) {
      const a = Math.round(s.t0 * 48000),
        b = Math.min(v.length, m.length, Math.round(s.t1 * 48000))
      const blk = []
      for (let i = a; i + 2400 <= b; i += 1200) {
        let x = 0,
          y = 0
        for (let j = i; j < i + 2400; j++) {
          x += v[j] * v[j]
          y += m[j] * m[j]
        }
        blk.push([x, y])
      }
      if (!blk.length) continue
      const top = Math.max(...blk.map((q) => q[0])),
        on = blk.filter((q) => q[0] >= top / 100)
      const ev = on.reduce((t, q) => t + q[0], 0),
        em = on.reduce((t, q) => t + q[1], 0)
      rows.push({ id: `${Ln.id}[${s.i}]`, t0: s.t0, db: 10 * Math.log10(ev / em) + gv - gm })
    }
  }
  return rows
}
async function filmAudio(film, out, tag, { keep = false } = {}) {
  const dir = path.join(WORK, 'audio')
  fs.mkdirSync(dir, { recursive: true })
  const sfxWav = sfxBus(
    film.sfx.filter((s) => s.kind === 'counter' || (s.at >= 0 && s.at < film.duration)),
    film.duration,
    path.join(dir, `sfx-${tag}.wav`),
    CACHE,
  )
  const voice = voiceStem(film, path.join(dir, `voice-${tag}.wav`))
  const score = musicStem(film, path.join(dir, `music-${tag}.wav`))
  const music = score.out
  // one gain for the bed, from the voice (lib/film-score.mjs bedGain), checked sentence by sentence
  const Lm = measure(music).lufs
  const gv = voice ? -16 - measure(voice).lufs : null
  let gainDb = bedGain({
      voiced: !!voice,
      wholeLufs: Lm,
      spanLufs: voice ? spanLufs(music, film.clock.bar0 + 2, film.endAt) : null,
    }),
    lower = 0,
    check = null
  if (voice) {
    const at = (g) => voiceOverMusic(film, voice, music, gv, g + (-16 - Lm))
    check = at(gainDb)
    lower = bedLower(Math.min(...check.map((r) => r.db)))
    if (lower) {
      gainDb -= lower
      check = at(gainDb)
    }
  }
  const r = await mix({
    out,
    duration: film.duration,
    music: { path: music, gainDb: +gainDb.toFixed(2), loop: false },
    sfx: [
      { path: sfxWav, at: 0, gainDb: -9 },
      // the voice stem at the house -16 LUFS reference, like mix() does for a single take
      ...(voice ? [{ path: voice, at: 0, gainDb: +gv.toFixed(2) }] : []),
    ],
    fadeOut: 0.9,
    // the finished mp4 (the same AAC, muxed and cut to the picture) measures up to 0.2 dB hotter
    // than the mix did on its own, so the mix aims under the house -1 dBTP
    truePeak: -1.4,
  })
  if (!keep) for (const f of [sfxWav, music, voice]) if (f) fs.rmSync(f, { force: true })
  const dbs = (check || []).map((x) => x.db).sort((x, y) => x - y)
  return {
    ...r,
    voiced: !!voice,
    music: { gainDb: +gainDb.toFixed(2), lower: +lower.toFixed(2), levels: score.levels },
    voiceOverMusic: dbs.length
      ? { min: +dbs[0].toFixed(1), median: +dbs[dbs.length >> 1].toFixed(1), rows: check }
      : null,
    gains: { music: +gainDb.toFixed(2), voice: gv === null ? null : +gv.toFixed(2), sfx: -9 },
  }
}

// ------------------------------------------------------------------ render
// render.mjs's encode, fed PNG frames on stdin, with the finished audio muxed in as it goes
function encoder(file, audio) {
  const args = [
    ...['-hide_banner', '-loglevel', 'error', '-y'],
    ...['-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-'],
    ...['-i', audio, '-map', '0:v', '-map', '1:a'],
    ...['-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p'],
    ...['-c:v', 'libx264', '-profile:v', 'high', '-level', '4.1', '-preset', 'slow', '-crf', '16'],
    ...[
      '-maxrate',
      '14M',
      '-bufsize',
      '20M',
      '-g',
      '30',
      '-keyint_min',
      '30',
      '-sc_threshold',
      '0',
    ],
    ...['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709'],
    ...['-color_range', 'tv', '-r', String(FPS), '-c:a', 'copy', '-shortest'],
    ...['-movflags', '+faststart', file],
  ]
  const p = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'inherit'] })
  const closed = new Promise((res, rej) =>
    p.on('close', (code) => (code === 0 ? res() : rej(new Error(`ffmpeg exited with ${code}`)))),
  )
  return {
    async write(buf) {
      if (!p.stdin.write(buf)) await new Promise((r) => p.stdin.once('drain', r))
    },
    async end() {
      p.stdin.end()
      await closed
    },
  }
}
// frames are drawn in runs, in order (every shot's animator only steps forward), each run
// rasterised across the browser's pages with the pictures its shots use
const CHUNK = 90
export async function renderFilm({
  lang,
  pages = 4,
  strip = 0,
  at = null,
  endStyle = 'handoff',
  voiceDir = VOICE_DIR,
  sheets = null,
  audio: audioOnly = false,
  log = console.log,
}) {
  const t0 = Date.now()
  const B = await openBrowser()
  try {
    const film = await buildFilm({ lang, B, voiceDir, endStyle, log })
    const { n, W } = film
    if (audioOnly) return await audioRun(film)
    const tag = `intro-${lang}-${process.pid}`
    const tmp = path.join(WORK, `frames-${tag}`)
    fs.rmSync(tmp, { recursive: true, force: true })
    fs.mkdirSync(tmp, { recursive: true })
    const want = at ? new Set(at.map((b) => Math.round(W(b) * FPS))) : null
    const full = !strip && !at
    const keep = (f) => (strip ? f % strip === 0 : want ? want.has(f) : true)
    const coverF = Math.round(W(COVER_AT) * FPS)
    const png = (f) => path.join(tmp, `${String(f).padStart(5, '0')}.png`)
    const out = filmFile(lang),
      jpg = filmFile(lang, '.jpg'),
      part = filmFile(lang, '.part.mp4')
    let enc = null,
      audio = null,
      sound = null
    if (full) {
      fs.mkdirSync(path.dirname(out), { recursive: true })
      audio = path.join(WORK, 'audio', `${tag}.m4a`)
      sound = await filmAudio(film, audio, tag)
      enc = encoder(part, audio)
    }
    const dayCache = new Map()
    for (let c0 = 0; c0 < n; c0 += CHUNK) {
      const frames = []
      for (let f = c0; f < Math.min(n, c0 + CHUNK); f++)
        if (keep(f) || f === 0 || (full && f === coverF)) frames.push(f)
      if (!frames.length) continue
      for (const sh of film.shots)
        if (sh.day) for (const [f, s] of sh.svgs(frames)) dayCache.set(`${sh.id}:${f}`, s)
      const items = [],
        defs = new Set()
      for (const f of frames) {
        // a swipe or a poof shows the shots either side of its join
        for (const sh of film.shots)
          if (f / FPS >= sh.T0 - 0.2 && f / FPS < sh.T1 + 0.2)
            for (const k of sh.defs || []) defs.add(k)
        const svg = frameSvg(film, f, dayCache)
        if (keep(f)) items.push({ svg, w: L.W, h: L.H, out: png(f) })
        if (full && f === coverF)
          items.push({
            svg: frameSvg(film, f, dayCache, { cover: true }),
            w: L.W,
            h: L.H,
            out: path.join(tmp, 'cover.png'),
          })
        for (const sh of film.shots) if (sh.day) dayCache.delete(`${sh.id}:${f}`)
      }
      await B.render(items, pages, { defs: defsFor([...defs], film.ctx) })
      if (enc)
        for (const f of frames)
          if (keep(f)) {
            await enc.write(fs.readFileSync(png(f)))
            fs.rmSync(png(f))
          }
      if (c0 % (CHUNK * 8) === 0) log(`  ${lang}: ${Math.min(n, c0 + CHUNK)}/${n} frames`)
    }
    if (at) {
      const outs = [...want]
        .sort((a, b) => a - b)
        .map((f) => {
          const o = path.join(WORK, `film-${lang}-${(f / FPS).toFixed(2)}.png`)
          fs.renameSync(png(f), o)
          return o
        })
      fs.rmSync(tmp, { recursive: true, force: true })
      return { stills: outs }
    }
    if (strip) {
      const o = path.join(WORK, `film-strip-${lang}.png`)
      const k = Math.ceil(n / strip)
      ff([
        ...['-pattern_type', 'glob', '-i', `${tmp}/*.png`],
        ...['-vf', `scale=135:240,tile=${Math.ceil(k / 6)}x6:padding=4:color=white`],
        ...['-frames:v', '1', o],
      ])
      fs.rmSync(tmp, { recursive: true, force: true })
      return { strip: o }
    }
    await enc.end()
    ff(['-i', path.join(tmp, 'cover.png'), '-q:v', '3', jpg])
    // a copying pass adds the cover as the attached picture (what galleries and share sheets show)
    ff([
      ...['-i', part, '-i', jpg, '-map', '0', '-map', '1', '-c', 'copy'],
      ...['-disposition:v:1', 'attached_pic', '-movflags', '+faststart', out],
    ])
    fs.rmSync(part, { force: true })
    fs.rmSync(tmp, { recursive: true, force: true })
    fs.rmSync(audio, { force: true })
    fs.writeFileSync(filmFile(lang, '.vtt'), vtt(film.caps))
    const preview = makePreview(out, filmFile(lang, '-preview.mp4'))
    const m = measure(out)
    const res = {
      lang,
      mp4: out,
      cover: jpg,
      vtt: filmFile(lang, '.vtt'),
      preview,
      durationSec: m.seconds,
      lufs: m.lufs,
      truePeak: m.truePeak,
      voiced: sound.voiced,
      sizeMB: +(fs.statSync(out).size / 1e6).toFixed(1),
      previewMB: +(fs.statSync(preview).size / 1e6).toFixed(2),
      seconds: +((Date.now() - t0) / 1000).toFixed(1),
    }
    if (sheets) Object.assign(res, reviewSheets(out, film, sheets))
    log(`wrote ${out}: ${m.seconds}s, ${m.lufs} LUFS, ${m.truePeak} dBTP, ${res.seconds}s`)
    return res
  } finally {
    await B.close()
  }
}
// --audio: the sound alone, no frames. The finished m4a, the three stems it was mixed from as they
// went in (before their gains), and a JSON of what they need to be measured against: her
// sentences, the SFX events, the score's plan and the gains.
async function audioRun(film) {
  const dir = path.join(WORK, 'audio')
  const lang = film.lang
  const m4a = path.join(dir, `film-${lang}.m4a`)
  const sound = await filmAudio(film, m4a, lang, { keep: true })
  const plan = planScore(film.clock, { endAt: film.endAt, duration: film.duration })
  const sents = []
  for (const Ln of Object.values(film.clock.lines))
    for (const s of Ln.sents)
      sents.push({ id: `${Ln.id}[${s.i}]`, t0: s.t0, t1: s.t1, mode: s.mode, take: !!Ln.take })
  sents.sort((a, b) => a.t0 - b.t0)
  const info = {
    lang,
    duration: film.duration,
    endAt: film.endAt,
    bar0: film.clock.bar0,
    anchors: film.clock.anchors,
    // the three hits: the title slam, the day-100 slam, the bonk
    hits: [film.clock.anchors.A, film.clock.anchors.B, film.bonkHit],
    sents,
    sfx: film.sfx
      .filter((s) => s.kind === 'counter' || (s.at >= 0 && s.at < film.duration))
      .map((s) => ({
        kind: s.kind,
        at: s.at ?? s.ticks[0][0],
        gainDb: s.gainDb ?? 0,
        ...(s.ticks ? { to: s.ticks[s.ticks.length - 1][0] } : {}),
      })),
    score: {
      joins: plan.joins,
      sections: plan.sections,
      end: plan.end,
      levels: sound.music.levels,
    },
    gains: sound.gains,
    lower: sound.music.lower,
    voiceOverMusic: sound.voiceOverMusic,
    lufs: sound.lufs,
    truePeak: sound.truePeak,
  }
  fs.writeFileSync(path.join(dir, `film-${lang}.json`), JSON.stringify(info, null, 1))
  const vom = sound.voiceOverMusic
  console.log(
    `${lang}: ${m4a} ${sound.lufs} LUFS ${sound.truePeak} dBTP; music ${sound.gains.music} dB` +
      (vom ? `, voice over music min ${vom.min} median ${vom.median} dB` : ', silent'),
  )
  return { lang, audio: m4a, lufs: sound.lufs, truePeak: sound.truePeak, voiced: sound.voiced }
}
// The preview: 720x1280 and under 8 MB whatever the locale's length, so two passes at the bitrate
// the length allows (7.6 MB for picture and sound)
function makePreview(src, out) {
  const dur = measure(src).seconds
  // The master's audio goes in as it is. A 64k AAC re-encode kept the loudness but overshot the
  // true peak by up to 2 dB, past 0 dBTP in two locales, so the preview no longer met the master's
  // -1 dBTP; copying costs ~130 kbps of picture, which is what the budget below takes off.
  const audioKbps = Math.ceil(
    +execFileSync('ffprobe', [
      ...['-v', 'error', '-select_streams', 'a:0'],
      ...['-show_entries', 'stream=bit_rate', '-of', 'csv=p=0', src],
    ]) / 1000,
  )
  const kbps = Math.floor((7.6 * 8e6) / dur / 1000) - audioKbps
  const passlog = out.replace(/\.mp4$/, '')
  const base = [
    ...['-i', src, '-map', '0:v:0', '-vf', 'scale=720:1280:flags=lanczos'],
    ...['-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-b:v', `${kbps}k`],
    ...[
      '-maxrate',
      `${Math.round(kbps * 1.5)}k`,
      '-bufsize',
      `${kbps * 2}k`,
      '-pix_fmt',
      'yuv420p',
    ],
    ...['-passlogfile', passlog],
  ]
  ff([...base, '-pass', '1', '-an', '-f', 'mp4', '/dev/null'])
  ff([...base, '-pass', '2', '-map', '0:a:0', '-c:a', 'copy', '-movflags', '+faststart', out])
  const dir = path.dirname(out)
  for (const f of fs.readdirSync(dir))
    if (f.startsWith(path.basename(passlog)) && /\.log(\.mbtree)?$/.test(f))
      fs.rmSync(path.join(dir, f))
  return out
}
// For review: the whole film as a contact sheet (a frame every 0.5 s) and the key beats at a
// readable size, both from the finished file
function reviewSheets(mp4, film, dir) {
  fs.mkdirSync(dir, { recursive: true })
  const strip = path.join(dir, `venus-intro-${film.lang}-strip.png`)
  const cells = Math.ceil(film.duration * 2)
  ff([
    ...['-i', mp4, '-map', '0:v:0'],
    ...['-vf', `fps=2,scale=108:192,tile=20x${Math.ceil(cells / 20)}:padding=4:color=white`],
    ...['-frames:v', '1', strip],
  ])
  const beats = path.join(dir, `venus-intro-${film.lang}-beats.png`)
  const tmp = path.join(WORK, `beats-${film.lang}-${process.pid}`)
  fs.mkdirSync(tmp, { recursive: true })
  KEY_BEATS.forEach((b, i) =>
    ff([
      ...['-ss', String(film.W(b)), '-i', mp4, '-map', '0:v:0', '-frames:v', '1'],
      ...['-vf', 'scale=270:480', path.join(tmp, `${String(i).padStart(3, '0')}.png`)],
    ]),
  )
  ff([
    ...['-pattern_type', 'glob', '-i', `${tmp}/*.png`],
    ...['-vf', `tile=8x${Math.ceil(KEY_BEATS.length / 8)}:padding=6:color=white`],
    ...['-frames:v', '1', beats],
  ])
  fs.rmSync(tmp, { recursive: true, force: true })
  return { strip, beats }
}

// ------------------------------------------------------------------ command line
if (import.meta.main) {
  const arg = (k, d) => {
    const i = process.argv.indexOf('--' + k)
    return i > 0 ? process.argv[i + 1] : d
  }
  // What this run is, decided once from which flags are present, never from a flag's value; and a
  // failure sets the exit code rather than exiting, so no branch on the command line ends the process
  const mode = process.argv.includes('--script')
    ? 'script'
    : process.argv.includes('--all')
      ? 'all'
      : 'one'
  switch (mode) {
    case 'script': {
      const file = arg('script')
      fs.writeFileSync(file, JSON.stringify(voiceScript(), null, 2) + '\n')
      console.log('wrote', file)
      break
    }
    case 'all': {
      // every locale in its own process: one browser each (separate browsers scale, pages do not)
      const jobs = +arg('jobs', 4)
      const pass = process.argv
        .slice(2)
        .filter((x, i, a) => x !== '--all' && x !== '--jobs' && a[i - 1] !== '--jobs')
      const queue = [...LOCALES],
        results = [],
        failed = []
      await Promise.all(
        Array.from({ length: jobs }, async () => {
          while (queue.length) {
            const lang = queue.shift()
            const p = spawn(
              process.execPath,
              [fileURLToPath(import.meta.url), '--lang', lang, ...pass],
              { stdio: ['ignore', 'pipe', 'inherit'] },
            )
            let text = ''
            p.stdout.on('data', (d) => {
              text += d
              process.stdout.write(d)
            })
            const code = await new Promise((r) => p.on('close', r))
            // one locale failing (a CDN hiccup, say) must not take the others' pipes down with it
            if (code !== 0) {
              failed.push(lang)
              continue
            }
            const line = text.split('\n').find((l) => l.startsWith('RESULT '))
            if (line) results.push(JSON.parse(line.slice(7)))
          }
        }),
      )
      console.log('ALL ' + JSON.stringify(results))
      if (failed.length) {
        console.error(`failed: ${failed.join(' ')}`)
        process.exitCode = 1
      }
      break
    }
    case 'one': {
      const lang = arg('lang')
      if (!LOCALES.includes(lang)) {
        console.error(
          'usage: node film.mjs --lang xx [--strip N | --at 12.4,64 | --audio] [--sheets dir] | --all | --script f',
        )
        process.exitCode = 2
        break
      }
      const res = await renderFilm({
        lang,
        pages: +arg('pages', 4),
        strip: +arg('strip', 0),
        at: arg('at') ? arg('at').split(',').map(Number) : null,
        endStyle: EC.styleOf(arg('end', 'handoff')),
        sheets: arg('sheets', null),
        audio: process.argv.includes('--audio'),
      })
      if (res.strip) console.log('strip', res.strip)
      if (res.stills) console.log('stills', res.stills.join(' '))
      console.log('RESULT ' + JSON.stringify(res))
      break
    }
  }
}
