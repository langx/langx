// One Venus streak story: 1080x1920, 30 fps, 8-11 s, H.264 + AAC, -14 LUFS / -1 dBTP.
//
//   node render.mjs --day 22 --lang tr                 -> out/v1/tr/venus-day022-tr.mp4 (VENUS_OUT moves out/)
//   node render.mjs --day 22 --lang tr --strip         contact strip of every 6th frame (work/), no video
//   node render.mjs --day 22 --lang tr --at 2.4,6      full-size stills at those times (work/)
//   options: --out <file>  --pages <n> (browser pages, default 4)  --force (re-render an existing file)
//            --end splash|handoff|sticker|legacy (the end card, lib/endcard.mjs; or VENUS_END)
//            --variant return (day 1 only: the welcome-back video -> venus-day001-return-<lang>.mp4;
//            the default day 1 is Venus's self-introduction, lib/intro.mjs)
//            --cover (only the cover still -> out/v1/<lang>/venus-dayNNN-<lang>.jpg; a full render writes it too)
//            --items prop:hamsi[,wear:crown] (previews only: swap the day's items; use --out, the
//            library file for that day would no longer match its plan)
//
// The plan comes from grammar.mjs, the acting from lib/score.mjs, the voice from voice/ (lib/voice.mjs,
// or VENUS_VOICE), and everything is re-timed from the measured voice on every run.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { planVideo, VARIANT_SUFFIX } from './lib/intro.mjs'
import { buildScore, EXTRA_EXPR } from './lib/score.mjs'
import { voiceFor, sentences, startsWithPurr, WHISPER_LAST } from './lib/voice.mjs'
import { analyseVoice, wordsOf, sfxBus, musicBed, mix, measure } from './lib/audio.mjs'
import { formatNumber, streakLabel, isRTL } from './lib/i18n.mjs'
import { openBrowser } from './lib/frames.mjs'
import { RIG, GEN, OUT, WORK, CACHE } from './lib/paths.mjs'
import * as L from './lib/layers.mjs'
import * as EC from './lib/endcard.mjs'
import { itemsFor, applyItemPose, itemLayers } from './lib/items.mjs'

const req = createRequire(import.meta.url)
const V = req(path.join(RIG, 'venus-rig.js')),
  VA = req(path.join(RIG, 'venus-anim.js'))
Object.assign(V.EXPR, EXTRA_EXPR)
export const FPS = 30
const G = 1500,
  BASE = 1.4,
  HEAD_H = 320 // ground line (px), rig scale, head centre above the ground (rig units, sitting)
const ff = (args) =>
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
    stdio: ['ignore', 'ignore', 'inherit'],
  })
export const outFile = (day, lang, variant = 'first') =>
  path.join(
    OUT,
    lang,
    `venus-day${String(day).padStart(3, '0')}${VARIANT_SUFFIX[variant]}-${lang}.mp4`,
  )
export const coverFile = (mp4) => mp4.replace(/\.mp4$/, '.jpg')
// The cover is the film's own frame just before her sign-off slow blink: every move hands her back
// sitting, centred and facing the lens by then (lib/score.mjs), in the day's items, eyes open, the
// caption gone. Only the number differs from that frame: full size rather than the badge it has shrunk
// to by then, so the cover says which day it is from across a gallery.
export const coverTime = (sc) => sc.blink - 0.08

// ------------------------------------------------------------------ voice timing
export function voiceTiming(plan, wav) {
  const text = plan.quip.text
  const A = analyseVoice(wav, text, FPS)
  const al = A.alignment,
    st = al.character_start_times_seconds,
    en = al.character_end_times_seconds
  const words = wordsOf(al)
  const sents = sentences(text).map((p) => ({
    t0: st[p.a],
    t1: en[p.b - 1],
    a: p.a,
    b: p.b,
    gapAfter: p.gapAfter,
    text: p.text,
  }))
  const purr = startsWithPurr(text) ? [words[0].t0, words[0].t1] : null
  const whisper =
    WHISPER_LAST.has(plan.quip.id) && sents.length > 1 ? sents[sents.length - 1].t0 : null
  const end = Math.max(A.voiceEnd, words[words.length - 1].t1)
  return { A, VT: { words, sents, purr, whisper, end } }
}

// ------------------------------------------------------------------ caption layout
// Sentences become bubble blocks; short neighbours share a block when they fit on two lines, but a
// "…" beat always starts a new block (the turn of the joke gets its own bubble) and so does a whisper.
async function layoutCaption(B, plan, VT) {
  const text = plan.quip.text,
    rtl = isRTL(plan.lang),
    MAXW = 760
  const fontCss = (F) => `900 ${F}px ${L.FONT}`
  const widths = {}
  const measure = async (F, list) => {
    const k = F + ''
    widths[k] = widths[k] || {}
    const need = list.filter((w) => !(w in widths[k]))
    if (need.length) {
      const r = await B.measure([...need, ' '], fontCss(F))
      need.forEach((w, i) => {
        widths[k][w] = r[i]
      })
      widths[k][' '] = r[r.length - 1]
    }
    return widths[k]
  }
  const wrap = async (ws, F, maxLines) => {
    const m = await measure(F, ws),
      sp = m[' ']
    const w = (a) => a.reduce((s, x, i) => s + m[x] + (i ? sp : 0), 0)
    if (w(ws) <= MAXW) return [ws]
    if (maxLines >= 2) {
      let best = null
      for (let i = 1; i < ws.length; i++) {
        const a = ws.slice(0, i),
          b = ws.slice(i),
          mx = Math.max(w(a), w(b))
        if (mx <= MAXW && (!best || mx < best.mx)) best = { mx, lines: [a, b] }
      }
      if (best) return best.lines
    }
    if (maxLines >= 3) {
      const lines = [[]]
      for (const x of ws) {
        const cur = lines[lines.length - 1]
        if (cur.length && w([...cur, x]) > MAXW) lines.push([x])
        else cur.push(x)
      }
      if (lines.length <= 3) return lines
    }
    return null
  }
  const fit = async (ws) => {
    for (const [F, n] of [
      [64, 2],
      [58, 2],
      [54, 3],
      [48, 3],
    ]) {
      const lines = await wrap(ws, F, n)
      if (lines) return { F, lines }
    }
    throw new Error(`caption too long: ${ws.join(' ')}`)
  }
  const S = VT.sents
  const groups = []
  for (let i = 0; i < S.length; i++) {
    const g = groups[groups.length - 1]
    const whisperHere = VT.whisper !== null && S[i].t0 === VT.whisper
    if (g && S[i - 1].gapAfter < 0.4 && !whisperHere) {
      const ws = text.slice(S[g[0]].a, S[i].b).split(/\s+/).filter(Boolean)
      if (await wrap(ws, 64, 2)) {
        g.push(i)
        continue
      }
    }
    groups.push([i])
  }
  let wi = 0
  const blocks = []
  for (const g of groups) {
    const ws = text
      .slice(S[g[0]].a, S[g[g.length - 1]].b)
      .split(/\s+/)
      .filter(Boolean)
    const { F, lines } = await fit(ws)
    blocks.push({
      lines,
      F,
      words: VT.words.slice(wi, wi + ws.length),
      whisper: VT.whisper !== null && S[g[0]].t0 === VT.whisper,
    })
    wi += ws.length
  }
  if (wi !== VT.words.length)
    console.warn(
      `day ${plan.day} ${plan.lang}: caption has ${wi} words, alignment ${VT.words.length}`,
    )
  const labelW =
    (await B.measure([streakLabel(plan.day, plan.lang)], `900 54px ${L.FONT}`))[0] +
    6 * [...streakLabel(plan.day, plan.lang)].length
  return { blocks, rtl, labelW }
}

// ------------------------------------------------------------------ audio
async function buildAudio(plan, sc, A, voice, out) {
  const dir = path.join(WORK, 'audio'),
    cache = CACHE
  fs.mkdirSync(dir, { recursive: true })
  fs.mkdirSync(cache, { recursive: true })
  const T = sc.T,
    list = [...sc.sfx]
  if (T.purr)
    list.push({
      kind: 'purr',
      at: T.purr[0] - 0.1,
      seconds: T.purr[1] - T.purr[0] + 0.55,
      gainDb: -2,
    })
  const tag = `${plan.lang}-${plan.day}-${process.pid}`
  const bus = sfxBus(list, sc.duration, path.join(dir, `sfx-${tag}.wav`), cache)
  const music = musicBed(
    plan.music,
    plan.musicSeed,
    12,
    path.join(cache, `music-${plan.music}-${plan.musicSeed}.wav`),
  )
  const r = await mix({
    out,
    duration: sc.duration,
    voice: { path: voice.wav, at: T.v, gainDb: 0, alignment: A.alignment },
    music: { path: music, gainDb: -6 },
    sfx: [{ path: bus, at: 0, gainDb: -6 }],
    fadeOut: 0.9,
    duckDb: 10,
  })
  fs.rmSync(bus, { force: true })
  return r
}

// ------------------------------------------------------------------ picture
// fit: her scale about the ground line (fitUnderLabel). probe: for the frames in `at`, only her
// figure in rig units, { fig } with what she wears and sits on, { bare } without.
export function frameSvgs(
  plan,
  sc,
  A,
  cap,
  ec,
  endStyle,
  { strip = 0, at = null, items = null, cover = false, fit = 1, probe = false } = {},
) {
  const T = sc.T,
    n = Math.round(sc.duration * FPS)
  const anim = VA.create({
    fps: FPS,
    duration: sc.duration,
    base: sc.base,
    expr: sc.expr,
    keys: sc.keys,
    add: sc.add,
    blinks: sc.blinks,
    springs: sc.springs,
    couple: sc.couple,
  })
  const num = {
    ...sc.num,
    text: formatNumber(plan.day, plan.lang),
    label: streakLabel(plan.day, plan.lang),
    labelW: cap.labelW,
    rtl: cap.rtl,
    format: (v) => formatNumber(v, plan.lang),
  }
  const toBadge = cover ? Infinity : T.v - 0.45
  const ctx = { numAt: sc.R, seed: plan.seed }
  const out = []
  let scene0 = ''
  const IT = itemsFor(plan, items) // the day's items (data/items.json): seat, wear, props
  for (let f = 0; f < n; f++) {
    const t = f / FPS,
      P = anim.at(f)
    // lip sync from the voice's loudness; brightness (s, ş, i, e) widens the mouth, dark vowels round it
    const vf = Math.round((t - T.v) * FPS)
    if (vf >= 0 && vf < A.env.length) {
      const e = A.env[vf]
      const inPurr = T.purr && t <= T.purr[1] + 0.05
      const k = t >= sc.whisperAt ? 0.55 : inPurr ? 0.25 : 1,
        b = A.bright[vf] ?? 0.5
      if (!(P.mouth.tongue > 0.3)) {
        P.mouth.open = Math.max(P.mouth.open * 0.5, e * 0.82 * k)
        P.mouth.wide = (P.mouth.wide ?? 1) * (0.72 + 0.55 * b)
      }
      P.head.pitch += 3.5 * e * k
    }
    const P0 = probe ? V.clone(P) : null
    applyItemPose(IT, t, P, sc)
    // frame 0 is always composed: the end card hands back to it (the loop)
    const skip = (strip && f % strip) || (at && !at.some((a) => Math.round(a * FPS) === f))
    if (skip && f !== 0) continue
    if (probe) {
      // air toys (the wand's stick, the moth) are not hers, so they do not count
      if (!skip)
        out.push({
          t,
          fig: itemLayers({ ...IT, air: null }, t, P, V.draw(P), sc),
          bare: V.draw(P0),
        })
      continue
    }
    // camera: the zoom keeps her face where it is on screen
    let z = L.trk(sc.cam.z, t)
    for (const b of sc.cam.bumps)
      if (t >= b && t < b + 0.35) z *= 1 + 0.06 * Math.sin(((t - b) / 0.35) * Math.PI)
    const s = BASE * z * fit
    let cx = 540 + (sc.cam.dx ? L.trk(sc.cam.dx, t) : 0),
      cy = G + HEAD_H * BASE * fit * (z - 1) - (sc.cam.lift ? L.trk(sc.cam.lift, t) : 0)
    for (const sh of sc.cam.shakes) {
      const u = t - sh
      if (u >= 0 && u < 0.3) {
        const a = 11 * Math.exp(-u * 12)
        cx += Math.sin(t * 97) * a
        cy += Math.cos(t * 83) * a
      }
    }
    const roll = sc.cam.roll ? L.trk(sc.cam.roll, t) : 0
    const look = plan.look
    let under = L.ground(look, t, cy, ctx) + L.number(look, t, num, toBadge)
    let over = ''
    if (sc.fx.ledge && P.y > 30) over += L.ledge(look, cy)
    for (const z0 of sc.fx.zzz) over += L.zzz(t, z0[0], z0[1], cx + 120, cy - 200 * s)
    if (sc.fx.poof !== null) over += L.poof(t, sc.fx.poof, cx, cy - 200 * s)
    for (const im of sc.fx.impacts) over += L.impact(t, im, cx, cy)
    for (const sp of sc.fx.sparkles) over += L.sparkles(t, sp[0], sp[1], sp[2], plan.seed)
    if (sc.fx.confetti !== null) over += L.confetti(t, sc.fx.confetti, plan.seed)
    if (sc.fx.flashes.length) over += L.flashes(t, sc.fx.flashes)
    if (cover)
      over += EC.badge(540, 1790, 44) // the small langx mark
    else over += L.bubble(look, t, cap.blocks, T.e + 0.15, cap.rtl)
    const hx = cx + P.x * s,
      hy = cy - HEAD_H * s
    const E =
      f === 0 ? null : EC.frame(endStyle, { u: t - sc.endAt, t, hx, hy, cx, cy, V, ec, scene0 })
    // v2 move props (sc.fx.props: the knock-off cork, the box, the moth...) sit round the figure;
    // inside the move's box she is clipped at its bottom edge
    let body = itemLayers(IT, t, P, V.draw(P), sc)
    const MP = sc.fx.props
    if (MP && MP.length)
      body =
        L.moveProps(MP, t, P, V, 'back') +
        (L.inBox(MP, t)
          ? `<clipPath id="mvbox${f}"><rect x="-2000" y="-4000" width="4000" height="4018"/></clipPath><g clip-path="url(#mvbox${f})">${body}</g>`
          : body) +
        L.moveProps(MP, t, P, V, 'front')
    let fig = `<g transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)}) scale(${s.toFixed(4)})">${body}</g>`
    if (E && E.fig) fig = `<g transform="${E.fig}">${fig}</g>`
    let scene = E && E.cover ? '' : under + fig + over
    if (scene && Math.abs(roll) > 0.01) {
      const r = (Math.abs(roll) * Math.PI) / 180,
        k = Math.cos(r) + (L.H / L.W) * Math.sin(r)
      scene = `<g transform="translate(540 960) rotate(${roll.toFixed(2)}) scale(${k.toFixed(4)}) translate(-540 -960)">${scene}</g>`
    }
    if (f === 0) scene0 = scene
    if (skip) continue
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${L.W}" height="${L.H}" viewBox="0 0 ${L.W} ${L.H}">${scene}${E ? E.over : ''}</svg>`
    out.push({ f, t, svg })
  }
  return out
}

// ------------------------------------------------------------------ room under the number
// The stage under the number is laid out for her own height, ears included. What she wears or sits
// on can reach higher: day 30's party hat on a cushion that lifts her, day 50's balloon. On such a
// day she is drawn smaller, about the ground line, just enough that her highest point stays under
// the label: the full-size label on the cover and while the number lands, the badge's for the rest
// of the film. Her height is measured in the cover's pose (sitting, facing the lens), so a nap on
// the cushion needs no room. A day whose items reach no higher than she does is drawn as before.
const LABEL_GAP = 12 // px between the label's lowest point and her highest
export async function fitUnderLabel(B, plan, sc, A, cap, ec, endStyle, items) {
  const [p] = frameSvgs(plan, sc, A, cap, ec, endStyle, { at: [coverTime(sc)], items, probe: true })
  // rig units, the ground at 0; the box is wider and taller than she ever is
  const [top, own] = await B.tops([p.fig, p.bare], [-700, -1100, 1400, 1200])
  if (!(top < own - 1)) return 1
  const text = formatNumber(plan.day, plan.lang)
  // the scale that keeps her top under `line` at zoom z (frameSvgs: y = G - fit * (G - y at fit 1))
  const fitAt = (line, z) => {
    const y = G + BASE * (HEAD_H * (z - 1) + top * z) // her top on screen at fit 1
    return Math.min(1, (G - line - LABEL_GAP) / (G - y))
  }
  const zMax = (t0, t1) => {
    let m = 0
    for (let t = t0; t <= t1; t += 1 / FPS) m = Math.max(m, L.trk(sc.cam.z, t))
    return m
  }
  const badge = sc.T.v - 0.45 + 0.32 // frameSvgs: the number starts for the badge at T.v - 0.45
  const fit = Math.min(
    fitAt(L.labelBottom(text), L.trk(sc.cam.z, coverTime(sc))),
    fitAt(L.labelBottom(text), zMax(sc.R, badge)),
    fitAt(L.labelBottom(text, true), zMax(badge, sc.endAt)),
  )
  return Math.floor(fit * 1000) / 1000 // so a measuring hair's difference never changes a frame
}

// ------------------------------------------------------------------ one video
export async function renderVideo({
  day,
  lang,
  variant = 'first',
  out = outFile(day, lang, variant),
  pages = 4,
  strip = 0,
  at = null,
  cover = false,
  force = false,
  browser = null,
  log = console.log,
  end = null,
  items = null,
}) {
  const endStyle = EC.styleOf(end)
  if (!strip && !at && !cover && !force && fs.existsSync(out)) return { skipped: true, out }
  const t0 = Date.now()
  const plan = planVideo(day, lang, variant)
  const voice = voiceFor(lang, plan.quip, { maxSeconds: plan.maxVoice ?? 4.6 })
  const { A, VT } = voiceTiming(plan, voice.wav)
  // fit 8-11 s (the day-1 specials: their own range): trim the reaction and payoff of a long line, hold the payoff of a short one
  const [minLen, maxLen] = plan.length ?? [8, 11]
  let sc = buildScore(plan, VT, { endStyle })
  for (let tight = 0.5; sc.duration > maxLen - 0.05 && tight <= 1.01; tight += 0.5)
    sc = buildScore(plan, VT, { tight, endStyle })
  if (sc.duration < minLen + 0.05)
    sc = buildScore(plan, VT, { pad: minLen + 0.1 - sc.duration, endStyle })
  if (sc.duration > maxLen || sc.duration < minLen)
    log(`  warning: day ${day} ${lang} ${variant} runs ${sc.duration}s`)
  const B = browser || (await openBrowser())
  try {
    const cap = await layoutCaption(B, plan, VT)
    // the layout is in voice time; the film places the voice at T.v
    for (const bl of cap.blocks)
      bl.words = bl.words.map((w) => ({ ...w, t0: w.t0 + sc.T.v, t1: w.t1 + sc.T.v }))
    const tag = `${lang}-${day}${VARIANT_SUFFIX[variant]}-${process.pid}`
    const ec = await EC.prepare(B, lang)
    const fit = await fitUnderLabel(B, plan, sc, A, cap, ec, endStyle, items)
    if (fit < 1) log(`  day ${day} ${lang}: drawn at ${fit} to keep her items under the label`)
    const tmp = path.join(WORK, `frames-${tag}`)
    fs.rmSync(tmp, { recursive: true, force: true })
    // the cover still (see coverTime): a JPEG beside the mp4, and the mp4's attached picture
    const jpg = coverFile(out)
    if (!strip && !at) {
      const [cv] = frameSvgs(plan, sc, A, cap, ec, endStyle, {
        at: [coverTime(sc)],
        items,
        cover: true,
        fit,
      })
      const png = path.join(WORK, `cover-${tag}.png`)
      await B.render([{ svg: cv.svg, w: L.W, h: L.H, out: png }], 1)
      fs.mkdirSync(path.dirname(jpg), { recursive: true })
      ff(['-i', png, '-q:v', '3', jpg])
      fs.rmSync(png, { force: true })
      if (cover) return { cover: path.relative(GEN, jpg), plan, sc }
    }
    const svgs = frameSvgs(plan, sc, A, cap, ec, endStyle, { strip, at, items, fit })
    await B.render(
      svgs.map((x) => ({
        svg: x.svg,
        w: L.W,
        h: L.H,
        out: path.join(tmp, `${String(x.f).padStart(4, '0')}.png`),
      })),
      pages,
    )
    if (at) {
      const outs = svgs.map((x) => {
        const o = path.join(
          WORK,
          `still-${lang}-${day}${VARIANT_SUFFIX[variant]}-${x.t.toFixed(2)}.png`,
        )
        fs.renameSync(path.join(tmp, `${String(x.f).padStart(4, '0')}.png`), o)
        return o
      })
      fs.rmSync(tmp, { recursive: true, force: true })
      return { stills: outs, plan, sc }
    }
    if (strip) {
      const o = path.join(
        WORK,
        `strip-${lang}-${String(day).padStart(3, '0')}${VARIANT_SUFFIX[variant]}.png`,
      )
      ff([
        '-pattern_type',
        'glob',
        '-i',
        `${tmp}/*.png`,
        '-vf',
        `scale=180:320,tile=${Math.ceil(svgs.length / 2)}x2:padding=4:color=white`,
        '-frames:v',
        '1',
        o,
      ])
      fs.rmSync(tmp, { recursive: true, force: true })
      return { strip: o, plan, sc }
    }
    fs.mkdirSync(path.dirname(out), { recursive: true })
    const audio = path.join(WORK, 'audio', `${tag}.m4a`)
    const mixed = await buildAudio(plan, sc, A, voice, audio)
    const part = out.replace(/\.mp4$/, '.part.mp4')
    ff([
      '-framerate',
      String(FPS),
      '-i',
      `${tmp}/%04d.png`,
      '-i',
      audio,
      '-map',
      '0:v',
      '-map',
      '1:a',
      '-vf',
      'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
      '-c:v',
      'libx264',
      '-profile:v',
      'high',
      '-level',
      '4.1',
      '-preset',
      'slow',
      '-crf',
      '16',
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
      '-colorspace',
      'bt709',
      '-color_primaries',
      'bt709',
      '-color_trc',
      'bt709',
      '-color_range',
      'tv',
      '-r',
      String(FPS),
      '-c:a',
      'copy',
      '-shortest',
      '-movflags',
      '+faststart',
      part,
    ])
    // a second, copying pass adds the cover as the attached picture (what galleries and share sheets show)
    ff([
      '-i',
      part,
      '-i',
      jpg,
      '-map',
      '0',
      '-map',
      '1',
      '-c',
      'copy',
      '-disposition:v:1',
      'attached_pic',
      '-movflags',
      '+faststart',
      out.replace(/\.mp4$/, '.cov.mp4'),
    ])
    fs.rmSync(part, { force: true })
    fs.renameSync(out.replace(/\.mp4$/, '.cov.mp4'), out)
    fs.rmSync(tmp, { recursive: true, force: true })
    fs.rmSync(audio, { force: true })
    const m = measure(out)
    const res = {
      day,
      lang,
      variant,
      file: path.relative(GEN, out),
      cover: path.relative(GEN, jpg),
      duration: m.seconds,
      lufs: m.lufs,
      truePeak: m.truePeak,
      quipId: plan.quip.id,
      placeholderVoice: voice.placeholder,
      seconds: +((Date.now() - t0) / 1000).toFixed(1),
      plan: {
        entrance: plan.entrance,
        reveal: plan.reveal,
        reaction: plan.reaction,
        move: plan.move,
        look: plan.look,
        camera: plan.camera,
        payoff: plan.payoff,
        music: plan.music,
      },
    }
    log(
      `wrote ${res.file}: ${m.seconds}s, ${m.lufs} LUFS, ${m.truePeak} dBTP, ${res.seconds}s to render (mix ${mixed.lufs} LUFS)`,
    )
    return res
  } finally {
    if (!browser) await B.close()
  }
}

if (import.meta.main) {
  const arg = (k, d) => {
    const i = process.argv.indexOf('--' + k)
    return i > 0 ? process.argv[i + 1] : d
  }
  const day = +arg('day'),
    lang = arg('lang', 'tr'),
    variant = arg('variant', 'first')
  if (!day) {
    console.error(
      'usage: node render.mjs --day N --lang xx [--strip] [--at 1.2,3] [--out f] [--force] [--variant return]',
    )
    process.exit(2)
  }
  const res = await renderVideo({
    day,
    lang,
    variant,
    out: arg('out', outFile(day, lang, variant)),
    pages: +arg('pages', 4),
    force: process.argv.includes('--force'),
    end: arg('end', null),
    items: arg('items', '')
      ? Object.fromEntries(
          arg('items')
            .split(',')
            .map((x) => x.split(':')),
        )
      : null,
    cover: process.argv.includes('--cover'),
    strip: process.argv.includes('--strip') ? +arg('every', 6) : 0,
    at: arg('at', '') ? arg('at').split(',').map(Number) : null,
  })
  if (res.strip) console.log('strip', res.strip)
  if (res.stills) console.log('stills', res.stills.join(' '))
  if (res.cover && !res.file) console.log('cover', res.cover)
  if (res.skipped) console.log('exists, skipped:', res.out)
  // one machine-readable line for batch.mjs
  console.log('RESULT ' + JSON.stringify({ ...res, sc: undefined }))
}
