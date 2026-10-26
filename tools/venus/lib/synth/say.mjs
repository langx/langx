// Offline TTS: macOS `say`, pitched up for a cartoon timbre, with an estimated
// character alignment in ElevenLabs' shape so the lip-sync code downstream
// never needs to know which path produced it.
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

// One character across locales where macOS has it: Eddy speaks en/de/es/fr/pt-BR.
// tr, ru and ar only ship one voice each, so those are the voices.
const VOICES = {
  en: { voice: 'Eddy (English (US))', pitch: 1.14 },
  de: { voice: 'Eddy (German (Germany))', pitch: 1.14 },
  es: { voice: 'Eddy (Spanish (Spain))', pitch: 1.14 },
  fr: { voice: 'Eddy (French (France))', pitch: 1.14 },
  'pt-BR': { voice: 'Eddy (Portuguese (Brazil))', pitch: 1.14 },
  tr: { voice: 'Yelda', pitch: 1.05 },
  ru: { voice: 'Milena (Russian (Russia))', pitch: 1.05 },
  ar: { voice: 'Majed', pitch: 1.12 },
}

let installed = null
function pickVoice(lang) {
  installed ??= execFileSync('say', ['-v', '?'], { encoding: 'utf8' })
  const want = VOICES[lang] || VOICES.en
  if (installed.includes(want.voice)) return want
  // Any installed voice for the locale beats failing.
  const loc =
    {
      en: 'en_US',
      de: 'de_DE',
      es: 'es_',
      fr: 'fr_FR',
      'pt-BR': 'pt_BR',
      tr: 'tr_TR',
      ru: 'ru_RU',
      ar: 'ar_',
    }[lang] || 'en_US'
  const line = installed.split('\n').find((l) => l.includes(loc))
  if (!line) throw new Error(`no macOS voice installed for ${lang}`)
  return { voice: line.split(/\s{2,}/)[0].trim(), pitch: want.pitch }
}

const ff = (args) =>
  execFileSync('ffmpeg', ['-hide_banner', '-nostats', '-y', ...args], {
    stdio: ['ignore', 'ignore', 'pipe'],
  })
// ffmpeg reports analysis filters on stderr even on success.
export const ffStderr = (args) =>
  spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args], { encoding: 'utf8' }).stderr || ''
export function probeDuration(file) {
  return +execFileSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file],
    { encoding: 'utf8' },
  ).trim()
}

// Voiced spans from silencedetect; used to place characters in time.
function voicedSpans(file, total) {
  const out = ffStderr(['-i', file, '-af', 'silencedetect=noise=-38dB:d=0.09', '-f', 'null', '-'])
  const sil = []
  let cur = null
  for (const l of out.split('\n')) {
    let m = l.match(/silence_start: ([\d.]+)/)
    if (m) cur = { s: +m[1], e: total }
    m = l.match(/silence_end: ([\d.]+)/)
    if (m && cur) {
      cur.e = +m[1]
      sil.push(cur)
      cur = null
    }
  }
  if (cur) sil.push(cur)
  const spans = []
  let t = 0
  for (const s of sil) {
    if (s.s > t + 0.02) spans.push([t, s.s])
    t = s.e
  }
  if (total > t + 0.02) spans.push([t, total])
  return spans
}

const VOWELS = /[aeiouyáàâäãåæéèêëíìîïóòôöõøúùûüıаеёиоуыэюяاوي]/i
function weight(ch) {
  if (/\s/.test(ch)) return 0.5
  if (/[,;:]/.test(ch)) return 1.5
  if (/[.!?…]/.test(ch)) return 2
  if (/\d/.test(ch)) return 3.5 // digits are spoken as whole words
  if (/[^\p{L}]/u.test(ch)) return 0.2
  return VOWELS.test(ch) ? 1.3 : 1
}

// Spread characters over voiced spans. If the number of internal pauses matches
// the number of phrase breaks in the text, each phrase gets its own span; else
// everything is spread over [first voice, last voice] by weight.
export function estimateAlignment(text, spans) {
  const chars = [...text]
  const starts = new Array(chars.length).fill(0)
  const ends = new Array(chars.length).fill(0)
  if (!spans.length)
    return {
      characters: chars,
      character_start_times_seconds: starts,
      character_end_times_seconds: ends,
    }
  const phrases = []
  let from = 0
  chars.forEach((c, i) => {
    if (/[,.!?;:…]/.test(c) && (i === chars.length - 1 || /\s/.test(chars[i + 1]))) {
      phrases.push([from, i + 1])
      from = i + 1
    }
  })
  if (from < chars.length) phrases.push([from, chars.length])
  const groups =
    phrases.length === spans.length
      ? phrases.map((p, k) => [p, spans[k]])
      : [
          [
            [0, chars.length],
            [spans[0][0], spans[spans.length - 1][1]],
          ],
        ]
  for (const [[a, b], [t0, t1]] of groups) {
    const w = chars.slice(a, b).map(weight)
    const total = w.reduce((x, y) => x + y, 0) || 1
    let t = t0
    for (let i = a; i < b; i++) {
      const d = ((t1 - t0) * w[i - a]) / total
      starts[i] = +t.toFixed(3)
      ends[i] = +(t + d).toFixed(3)
      t += d
    }
  }
  return {
    characters: chars,
    character_start_times_seconds: starts,
    character_end_times_seconds: ends,
  }
}

export function sayTts(text, lang, outMp3, { speed = 1.04 } = {}) {
  const { voice, pitch } = pickVoice(lang)
  const tmp = outMp3.replace(/\.mp3$/, '.raw.aiff')
  fs.mkdirSync(path.dirname(outMp3), { recursive: true })
  execFileSync('say', ['-v', voice, '-o', tmp, text])
  // asetrate raises pitch and formants together (the cartoon part), atempo
  // puts the speed back, then a little presence and compression so it sits on music.
  const af = [
    'aresample=44100',
    `asetrate=${Math.round(44100 * pitch)}`,
    'aresample=44100',
    `atempo=${(speed / pitch).toFixed(4)}`,
    'highpass=f=90',
    'equalizer=f=3200:t=q:w=1:g=3',
    'acompressor=threshold=-20dB:ratio=3:attack=5:release=80:makeup=2',
    'adelay=60', // a hair of pre-roll so the first consonant is not clipped
    'apad=pad_dur=0.15',
  ].join(',')
  ff(['-i', tmp, '-af', af, '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '128k', outMp3])
  fs.rmSync(tmp, { force: true })
  const dur = probeDuration(outMp3)
  const alignment = estimateAlignment(text, voicedSpans(outMp3, dur))
  return { mp3Path: outMp3, alignment, voice, seconds: dur }
}
