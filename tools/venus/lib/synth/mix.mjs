// Final audio for a Lafi video: voice + music bed + timed SFX -> AAC/M4A at
// -14 LUFS integrated, <= -1 dBTP, music ducked under the voice, clean fade-out.
//
//   await mix({
//     out: 'day22.m4a', duration: 10,
//     voice: { path, at: 2.4, gainDb: 0, alignment },   // alignment optional
//     music: { path, gainDb: -5, loop: true },   // gains relative to -16 LUFS
//     sfx: [{ path, at: 0.3, gainDb: -6 }, ...],
//     fadeOut: 1.2, duckDb: 9,
//   })
//
// Ducking: with an alignment we know exactly when Lafi speaks, so the music is
// automated down slightly *before* each phrase (a compressor can only react
// after it). Without one, sidechaincompress keyed on the voice does it.
// Loudness: gain + true-peak-safe limiter, encode, measure the encoded file,
// correct and repeat; we only stop on numbers measured on the actual .m4a,
// because AAC adds its own inter-sample peaks.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ffStderr, probeDuration } from './say.mjs'

const ff = (args) =>
  execFileSync('ffmpeg', ['-hide_banner', '-nostats', '-loglevel', 'error', '-y', ...args], {
    stdio: ['ignore', 'ignore', 'inherit'],
  })

export function measure(file) {
  const out = ffStderr(['-i', file, '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-'])
  const sum = out.slice(out.lastIndexOf('Summary:'))
  const num = (re) => +(sum.match(re) || [])[1]
  return {
    lufs: num(/I:\s+(-?[\d.]+) LUFS/),
    lra: num(/LRA:\s+(-?[\d.]+) LU/),
    truePeak: num(/Peak:\s+(-?[\d.]+) dBFS/),
    seconds: probeDuration(file),
  }
}

// Phrases from a character alignment: runs of characters with gaps < 0.25 s.
export function speechSpans(alignment, offset = 0) {
  const {
    characters: c,
    character_start_times_seconds: s,
    character_end_times_seconds: e,
  } = alignment
  const spans = []
  for (let i = 0; i < c.length; i++) {
    if (/\s/.test(c[i]) || e[i] <= s[i]) continue
    const last = spans[spans.length - 1]
    if (last && s[i] - last[1] < 0.25) last[1] = e[i]
    else spans.push([s[i], e[i]])
  }
  return spans.map(([a, b]) => [a + offset, b + offset])
}

// volume expression: 1 - depth * max_i(trapezoid_i(t)); ramps 0.15 s in (ahead
// of the voice), 0.35 s out (music swells back after the line lands).
function duckExpr(spans, duckDb, pre = 0.15, post = 0.35) {
  const depth = 1 - Math.pow(10, -duckDb / 20)
  const tri = spans.map(
    ([a, b]) =>
      `clip(min((t-${(a - pre).toFixed(3)})/${pre},(${(b + post).toFixed(3)}-t)/${post}),0,1)`,
  )
  const mx = tri.reduce((acc, x) => (acc ? `max(${acc},${x})` : x), '')
  return `1-${depth.toFixed(4)}*${mx || 0}`
}

export async function mix({
  out,
  duration,
  voice,
  music,
  sfx = [],
  fadeOut = 1.2,
  fadeIn = 0.02,
  duckDb = 9,
  lufs = -14,
  truePeak = -1,
  bitrate = '192k',
}) {
  const inputs = []
  const chains = []
  const toMix = []
  const fmt = 'aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo'
  const fit = `apad,atrim=0:${duration}`
  const ms = (sec) => Math.max(0, Math.round(sec * 1000))
  // Voice and music are first brought to a common -16 LUFS, so gainDb means the
  // same thing whether the stem came from ElevenLabs or the fallback (their raw
  // levels differ by 10 dB). SFX keep their own peak-normalised level.
  const REF = -16
  const norm = (file) => {
    const l = measure(file).lufs
    return Number.isFinite(l) && l > -70 ? REF - l : 0
  }

  if (music) {
    if (music.loop !== false) inputs.push('-stream_loop', '-1')
    inputs.push('-i', music.path)
    chains.push(
      `[${inputs.filter((x) => x === '-i').length - 1}:a]${fmt},atrim=0:${duration},asetpts=N/SR/TB,${fit},volume=${((music.gainDb ?? -5) + norm(music.path)).toFixed(2)}dB[mus]`,
    )
  }
  if (voice) {
    inputs.push('-i', voice.path)
    const idx = inputs.filter((x) => x === '-i').length - 1
    chains.push(
      `[${idx}:a]${fmt},adelay=${ms(voice.at || 0)}:all=1,${fit},volume=${((voice.gainDb ?? 0) + norm(voice.path)).toFixed(2)}dB,asplit=2[vox][key]`,
    )
    toMix.push('[vox]')
    if (music) {
      if (voice.alignment) {
        chains.push(`[key]anullsink`)
        chains.push(
          `[mus]volume='${duckExpr(speechSpans(voice.alignment, voice.at || 0), duckDb)}':eval=frame[musd]`,
        )
      } else {
        chains.push(`[key]highpass=f=150[k2]`)
        chains.push(
          `[mus][k2]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=350:knee=4[musd]`,
        )
      }
      toMix.push('[musd]')
    } else chains.push('[key]anullsink')
  } else if (music) toMix.push('[mus]')
  sfx.forEach((s, i) => {
    inputs.push('-i', s.path)
    const idx = inputs.filter((x) => x === '-i').length - 1
    chains.push(
      `[${idx}:a]${fmt},adelay=${ms(s.at)}:all=1,${fit},volume=${s.gainDb ?? -6}dB[s${i}]`,
    )
    toMix.push(`[s${i}]`)
  })
  // The fade lands 0.12 s early and the rest is true silence, so the file ends
  // (or loops on Instagram) without a tick.
  const tailSilence = Math.min(0.12, fadeOut / 4)
  const fadeStart = Math.max(0, duration - fadeOut)
  chains.push(
    `${toMix.join('')}amix=inputs=${toMix.length}:normalize=0:duration=longest,atrim=0:${duration},afade=t=in:d=${fadeIn},afade=t=out:st=${fadeStart}:d=${(fadeOut - tailSilence).toFixed(3)}:curve=hsin[pre]`,
  )

  const tmpDir = path.join(path.dirname(path.resolve(out)), '.mixtmp')
  fs.mkdirSync(tmpDir, { recursive: true })
  const premix = path.join(tmpDir, `${path.basename(out)}.pre.wav`)
  ff([
    ...inputs,
    '-filter_complex',
    chains.join(';'),
    '-map',
    '[pre]',
    '-c:a',
    'pcm_f32le',
    '-ar',
    '48000',
    premix,
  ])

  // Gain to target, limiter with headroom for the encoder, measure the encode.
  let gain = lufs - measure(premix).lufs
  let ceiling = truePeak - 0.6
  let m
  for (let pass = 0; pass < 4; pass++) {
    const limit = Math.pow(10, ceiling / 20).toFixed(4)
    ff([
      '-i',
      premix,
      '-af',
      `volume=${gain.toFixed(2)}dB,alimiter=limit=${limit}:attack=3:release=60:level=disabled:latency=1`,
      '-c:a',
      'aac',
      '-b:a',
      bitrate,
      '-ar',
      '48000',
      '-movflags',
      '+faststart',
      out,
    ])
    m = measure(out)
    const lufsOk = Math.abs(m.lufs - lufs) <= 0.2
    const tpOk = m.truePeak <= truePeak
    if (lufsOk && tpOk) break
    if (!tpOk) ceiling -= m.truePeak - truePeak + 0.2
    if (!lufsOk) gain += lufs - m.lufs
  }
  fs.rmSync(premix, { force: true })
  return { out, ...m, target: { lufs, truePeak } }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  // node mix.mjs spec.json  — the spec is the object mix() takes.
  const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
  mix(spec).then(
    (r) => console.log(JSON.stringify(r, null, 2)),
    (e) => {
      console.error(e.message)
      process.exit(1)
    },
  )
}
