// Venus's voice for one quip in one locale. Every line is voiced once per locale and cached; the
// number is never spoken (it is on screen), so one file serves every day that uses the line.
// voice/ is VENUS_VOICE when it is set (lib/paths.mjs).
//
//   voice/<lang>/<quipId>.wav    a real recording (ElevenLabs or anything else). Always wins.
//   voice/<lang>/<quipId>.json   optional: its character alignment (ElevenLabs `alignment` object,
//                                or the whole with-timestamps response). Without it the words are
//                                spread over the voiced spans.
//   voice/_placeholder/<lang>/<quipId>.wav + .json
//                                a macOS `say` stand-in, made on demand, with an exact alignment
//                                (each sentence is synthesised on its own, so its span is known).
//   voice/needed.json            every (lang, quipId, text) the library uses that has no real file.
//
// Real files are never written or overwritten by this code.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { VOICE_DIR } from './paths.mjs'

export { VOICE_DIR }
const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args])

// placeholder voices: the closest young-woman voice macOS ships per locale
export const SAY_VOICE = {
  tr: 'Yelda',
  ru: 'Milena',
  ar: 'Majed',
  de: 'Anna',
  fr: 'Amélie',
  es: 'Mónica',
  'pt-BR': 'Luciana',
  en: 'Samantha',
}
const SAY_RATE = { tr: 172, en: 182, es: 178, fr: 180, de: 176, ru: 174, ar: 165, 'pt-BR': 180 }
// the voice to record with later. Behic chose Elif Özder for Turkish; the rest are still open.
export const REAL_VOICE = { tr: 'Elif Özder (ElevenLabs)' }
const PITCH = 1.12 // a little up: a young woman, not a chipmunk
// the purr-word "Mrrr" is a sound, not letters; `say` spells it out unless it is respelled
const PURR = /^(M[ıi]?r+|Мр+|مر+)/u
const PURR_SAY = {
  tr: 'Mmmırr',
  en: 'Mmmrr',
  es: 'Mmmrr',
  fr: 'Mmmrr',
  de: 'Mmmrr',
  'pt-BR': 'Mmmrr',
  ru: 'Мммрр',
  ar: 'ممممم',
}
// lines whose last sentence is whispered (the picture leans in for it)
export const WHISPER_LAST = new Set(['ms-100-a'])

export const startsWithPurr = (text) => PURR.test(text.trim())

// "I've seen better. …In the mirror." -> [{ a, b, text, gapAfter }] over the caption text's characters
export function sentences(text) {
  const parts = []
  const re = /[^.!?…؟]+(?:[.!?…؟]+|$)/gu
  let m
  while ((m = re.exec(text))) {
    let a = m.index,
      b = m.index + m[0].length
    while (a < b && /\s/.test(text[a])) a++
    while (b > a && /\s/.test(text[b - 1])) b--
    if (b > a) parts.push({ a, b })
  }
  // a "…" that opens the text belongs to the first sentence ("…Almost everything."): the pattern
  // above never starts a part on one, so without this the caption and the bubble dropped it
  if (parts.length && /^[…\s]+$/u.test(text.slice(0, parts[0].a))) {
    let a = 0
    while (/\s/.test(text[a])) a++
    parts[0].a = a
  }
  // a part made only of "…" belongs to the next one ("…In the mirror.")
  for (let i = 0; i < parts.length - 1; i++)
    if (/^[…\s]+$/u.test(text.slice(parts[i].a, parts[i].b))) {
      parts[i + 1].a = parts[i].a
      parts.splice(i, 1)
      i--
    }
  return parts.map((p, i) => {
    const s = text.slice(p.a, p.b),
      next = parts[i + 1] ? text.slice(parts[i + 1].a, parts[i + 1].b) : ''
    const beat = /…$/u.test(s) || /^…/u.test(next)
    return { ...p, text: s, gapAfter: i === parts.length - 1 ? 0 : beat ? 0.42 : 0.16 }
  })
}

const real = (lang, id) => path.join(VOICE_DIR, lang, `${id}.wav`)
const ph = (lang, id) => path.join(VOICE_DIR, '_placeholder', lang, `${id}.wav`)
export const hasReal = (lang, id) => fs.existsSync(real(lang, id))

function probe(file) {
  return +execFileSync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'csv=p=0',
    file,
  ])
    .toString()
    .trim()
}

function sayPart(text, lang, out, { whisper = false, tempo = 1 } = {}) {
  const raw = out + '.aiff'
  execFileSync('say', ['-v', SAY_VOICE[lang], '-r', String(SAY_RATE[lang]), '-o', raw, text])
  const af = [
    'aresample=48000',
    `asetrate=${Math.round(48000 * PITCH)}`,
    'aresample=48000',
    `atempo=${(tempo / PITCH).toFixed(4)}`,
    'highpass=f=110',
    'equalizer=f=3200:t=q:w=1:g=3',
    // trim the silence `say` leaves round each sentence, so the gaps are ours
    'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.04,areverse',
  ]
  if (whisper)
    af.push(
      'highpass=f=420',
      'equalizer=f=6500:t=q:w=1.2:g=7',
      'equalizer=f=900:t=q:w=1:g=-5',
      'volume=-7dB',
    )
  af.push('acompressor=threshold=-22dB:ratio=3:attack=5:release=90:makeup=2')
  ff(['-i', raw, '-af', af.join(','), '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s16le', out])
  fs.rmSync(raw, { force: true })
  return probe(out)
}

export const weight = (c) =>
  /\s/.test(c)
    ? 0.6
    : /[.,!?…؟،]/u.test(c)
      ? 0.3
      : /[aeiouyıöüäâêîôûéèàáíóúãõаеёиоуыэюяاوي]/iu.test(c)
        ? 1.3
        : 1

// Make (or reuse) the placeholder. maxSeconds: the longest the line may run in the video; a longer
// `say` take is sped up (at most 1.3x) so the video stays within 11 s.
export function makePlaceholder(lang, id, text, { maxSeconds = 4.6, force = false } = {}) {
  const out = ph(lang, id),
    json = out.replace(/\.wav$/, '.json')
  if (!force && fs.existsSync(out) && fs.existsSync(json)) return { wav: out, json }
  fs.mkdirSync(path.dirname(out), { recursive: true })
  const parts = sentences(text)
  const whisperAt = WHISPER_LAST.has(id) && parts.length > 1 ? parts.length - 1 : -1
  const render = (tempo) =>
    parts.map((p, i) => {
      let s = p.text
        .replace(/[…"'«»]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (i === 0 && PURR.test(s)) s = s.replace(PURR, PURR_SAY[lang])
      const f = `${out}.part${i}.wav`
      return { f, dur: sayPart(s, lang, f, { whisper: i === whisperAt, tempo }), gap: p.gapAfter }
    })
  let pr = render(1)
  const total = (q) => 0.04 + q.reduce((s, p) => s + p.dur + p.gap, 0)
  if (total(pr) > maxSeconds) pr = render(Math.min(1.3, total(pr) / maxSeconds + 0.02))
  // join with explicit gaps
  const inputs = [],
    chain = []
  pr.forEach((p, i) => {
    inputs.push('-i', p.f)
    chain.push(`[${i}:a]apad=pad_dur=${p.gap}[p${i}]`)
  })
  chain.push(
    `${pr.map((_, i) => `[p${i}]`).join('')}concat=n=${pr.length}:v=0:a=1,adelay=40,apad=pad_dur=0.12[o]`,
  )
  ff([
    ...inputs,
    '-filter_complex',
    chain.join(';'),
    '-map',
    '[o]',
    '-ar',
    '48000',
    '-ac',
    '1',
    '-c:a',
    'pcm_s16le',
    out,
  ])
  // exact alignment: each sentence's characters spread over its own span, by a rough weight
  const chars = [...text],
    st = new Array(chars.length).fill(0),
    en = new Array(chars.length).fill(0)
  // every quip is in the BMP, so UTF-16 offsets from sentences() are character indices
  if (chars.length !== text.length) throw new Error(`${id}: characters outside the BMP`)
  let t = 0.04,
    prevEnd = 0
  parts.forEach((p, i) => {
    const a = p.a,
      b = p.b,
      d = pr[i].dur
    for (let j = prevEnd; j < a; j++) {
      st[j] = t
      en[j] = t
    }
    const w = chars.slice(a, b).map(weight),
      W = w.reduce((x, y) => x + y, 0) || 1
    let u = t
    for (let j = a; j < b; j++) {
      const dd = (d * w[j - a]) / W
      st[j] = +u.toFixed(3)
      en[j] = +(u + dd).toFixed(3)
      u += dd
    }
    t += d + pr[i].gap
    prevEnd = b
  })
  for (let j = prevEnd; j < chars.length; j++) {
    st[j] = t
    en[j] = t
  }
  fs.writeFileSync(
    json,
    JSON.stringify({
      placeholder: true,
      voice: SAY_VOICE[lang],
      alignment: {
        characters: chars,
        character_start_times_seconds: st,
        character_end_times_seconds: en,
      },
    }),
  )
  for (const p of pr) fs.rmSync(p.f, { force: true })
  return { wav: out, json }
}

// The file to use for (lang, quip): the real recording if there is one, else the placeholder.
export function voiceFor(lang, quip, opts = {}) {
  const r = real(lang, quip.id)
  if (fs.existsSync(r)) {
    const j = r.replace(/\.wav$/, '.json')
    return { wav: r, json: fs.existsSync(j) ? j : null, placeholder: false }
  }
  return { ...makePlaceholder(lang, quip.id, quip.text, opts), placeholder: true }
}

// voice/needed.json: everything the given plans use that still needs a real recording
export function writeNeeded(plans) {
  const seen = new Map()
  for (const p of plans) {
    const k = `${p.lang}/${p.quip.id}`
    if (hasReal(p.lang, p.quip.id)) continue
    if (!seen.has(k))
      seen.set(k, {
        lang: p.lang,
        quipId: p.quip.id,
        text: p.quip.text,
        whisperLastSentence: WHISPER_LAST.has(p.quip.id),
        voice: REAL_VOICE[p.lang] || 'to be chosen',
        file: `voice/${p.lang}/${p.quip.id}.wav`,
        days: [],
      })
    if (!seen.get(k).days.includes(p.day)) seen.get(k).days.push(p.day)
  }
  const list = [...seen.values()].sort(
    (a, b) => a.lang.localeCompare(b.lang) || a.quipId.localeCompare(b.quipId),
  )
  const byLang = {}
  for (const x of list) byLang[x.lang] = (byLang[x.lang] || 0) + 1
  fs.mkdirSync(VOICE_DIR, { recursive: true })
  const chars = list.reduce((s, x) => s + x.text.length, 0)
  fs.writeFileSync(
    path.join(VOICE_DIR, 'needed.json'),
    JSON.stringify(
      {
        note: 'Lines the video library uses that have no real recording yet. Record each as voice/<lang>/<quipId>.wav (WAV, 44.1 or 48 kHz). Put the ElevenLabs with-timestamps alignment next to it as <quipId>.json for exact captions. "…" is a ~400 ms beat. The number is never spoken.',
        voices: { tr: 'Elif Özder', others: 'to be chosen' },
        total: list.length,
        characters: chars,
        byLang,
        lines: list,
      },
      null,
      2,
    ) + '\n',
  )
  return list
}
