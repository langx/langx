/**
 * Cuts `out/raw/journey.webm` into the finished 1080x1920 video.
 *
 * Nothing here is hand-timed: the trim points, the excised waits and every
 * caption window come out of `marks.json`, which `capture.mjs` measured while
 * it recorded.
 *
 * What gets excised is dead time — the seconds where the app is fetching and
 * the screen is a skeleton, and the minute where a second browser is driven
 * off camera so that the reply is a real one. Each is replaced by a short
 * dissolve, so it reads as an edit rather than as a stutter. Nothing a viewer
 * is watching work is sped up; the cuts are where nothing happens at all.
 *
 * Two ffmpeg habits this file exists to avoid repeating:
 *   - captions go in through `textfile=`, never `text=`. A colon inside
 *     `text=` breaks the filter graph even when quoted, and an apostrophe is
 *     worse.
 *   - no emoji anywhere. `drawtext` refuses a colour emoji font outright, and
 *     an emoji inside Nunito draws a silent white box rather than failing.
 *
 * Usage: node tools/promo-video/compose.mjs [locale]
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeBed } from './music.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const RAW = join(HERE, 'out/raw')
const OUT = join(HERE, 'out')
const FONTS = join(HERE, '../../apps/api/assets/fonts')
const BOLD = join(FONTS, 'Nunito_800ExtraBold.ttf')
const SEMI = join(FONTS, 'Nunito_600SemiBold.ttf')

/**
 * A locale this tool actually has copy for, and the value returned is the one
 * out of `captions.json` rather than the one off the command line — it goes on
 * to name files, and a whitelist that hands back the input it matched is not a
 * whitelist.
 */
function localeArg() {
  const wanted = process.argv[2] ?? 'en'
  const known = Object.keys(JSON.parse(readFileSync(join(HERE, 'captions.json'), 'utf8')))
  const found = known.find((locale) => locale === wanted)
  if (!found) throw new Error(`no captions for "${wanted}" — have ${known.join(', ')}`)
  return found
}

const LOCALE = localeArg()
const FFMPEG = 'ffmpeg'

/** `theme/tokens.ts`, as ffmpeg wants them. */
const INK = '0x17191c'
const PAPER = '0xffffff'
const PRIMARY = '0xffc409'

/** The finished canvas, and the phone inside it. */
const W = 1080
const H = 1920
const PHONE_W = 698
const PHONE_H = 1500
const BORDER = 6
const PHONE_Y = 300
const BAND_H = 94
const END_SECONDS = 2
/** The dissolve that replaces an excised wait, and the one into the end card. */
const CUT_FADE = 0.3
const END_FADE = 0.5

/**
 * The waits worth removing, as pairs of marks.
 *
 * `keepBefore` leaves the tap visible and `keepAfter` leaves the screen
 * arriving visible — cut flush against either and the action itself disappears
 * along with the wait. A span too short to be worth a dissolve is left alone.
 */
const CUTS = [
  { from: 'profileClicked', to: 'profilePainted', keepBefore: 0.35, keepAfter: 0.25 },
  { from: 'chatOpenClicked', to: 'chatPainted', keepBefore: 0.4, keepAfter: 0.25 },
  { from: 'sendClicked', to: 'delivered', keepBefore: 0.6, keepAfter: 0.35 },
  { from: 'awaitReply', to: 'replied', keepBefore: 0.4, keepAfter: 0.3 },
]

function marksFor() {
  const { marks } = JSON.parse(readFileSync(join(RAW, 'marks.json'), 'utf8'))
  const at = (name) => {
    const found = marks.find((mark) => mark.name === name)
    if (!found) throw new Error(`no mark "${name}" in marks.json`)
    return found.at
  }
  return { at, has: (name) => marks.some((mark) => mark.name === name) }
}

/** A caption's own file, so nothing in the copy has to be escaped. */
function textfile(name, body) {
  const path = join(RAW, `${name}.txt`)
  writeFileSync(path, body)
  return path
}

/**
 * Turn a time in the recording into its time in the finished video.
 *
 * Each kept segment sits after the ones before it, minus the dissolve it
 * overlaps them by. Caption marks are always inside a kept segment: they mark
 * screens, and the cuts are between screens.
 */
function timeline(segments) {
  return (t) => {
    let out = 0
    for (const [index, segment] of segments.entries()) {
      const overlap = index === 0 ? 0 : CUT_FADE
      if (t <= segment.end) return Math.max(0, out + (t - segment.start) - overlap)
      out += segment.end - segment.start - overlap
    }
    return out
  }
}

function main() {
  const copy = JSON.parse(readFileSync(join(HERE, 'captions.json'), 'utf8'))[LOCALE]
  if (!copy) throw new Error(`captions.json has no "${LOCALE}"`)
  const { at, has } = marksFor()
  const start = at('journeyStart')
  const end = at('journeyEnd')

  const segments = []
  let cursor = start
  for (const cut of CUTS) {
    if (!has(cut.from) || !has(cut.to)) continue
    const from = at(cut.from) + cut.keepBefore
    const to = at(cut.to) - cut.keepAfter
    if (to - from < CUT_FADE * 2) continue
    segments.push({ start: cursor, end: from })
    cursor = to
  }
  segments.push({ start: cursor, end })

  const kept = segments.reduce((total, segment) => total + (segment.end - segment.start), 0)
  const journey = kept - CUT_FADE * (segments.length - 1)
  const total = journey + END_SECONDS - END_FADE
  const toOut = timeline(segments)
  console.log(
    `${segments.length} segment(s), ${(end - start - kept).toFixed(1)}s of waiting removed`,
  )

  mkdirSync(OUT, { recursive: true })
  const hook = copy.hook.map((line, index) => textfile(`hook${index + 1}`, line))

  // Each caption runs from its own mark to the next one's, the last to the end.
  const windows = copy.subtitles.map((caption, index) => ({
    file: textfile(`sub${index + 1}`, caption.text),
    from: toOut(at(caption.from)),
    to: index + 1 < copy.subtitles.length ? toOut(at(copy.subtitles[index + 1].from)) : journey,
  }))

  const drawHook = hook
    .map(
      (file, index) =>
        `drawtext=fontfile='${BOLD}':textfile='${file}':fontsize=58:` +
        `fontcolor=${index === 0 ? PAPER : PRIMARY}:x=(w-text_w)/2:y=${110 + index * 80}`,
    )
    .join(',')

  const drawSubs = windows
    .map(
      ({ file, from, to }) =>
        `drawtext=fontfile='${SEMI}':textfile='${file}':fontsize=38:fontcolor=${PAPER}:` +
        `x=(w-text_w)/2:y=${H - BAND_H + 26}:enable='between(t,${from.toFixed(2)},${to.toFixed(2)})'`,
    )
    .join(',')

  // One branch per kept segment, each trimmed and scaled identically, then
  // dissolved together in order — `xfade` insists on matching size and SAR.
  const steps = [`[0:v]split=${segments.length}${segments.map((_, i) => `[src${i}]`).join('')}`]
  segments.forEach((segment, index) => {
    steps.push(
      `[src${index}]trim=start=${segment.start.toFixed(3)}:end=${segment.end.toFixed(3)},` +
        `setpts=PTS-STARTPTS,fps=25,scale=-2:${PHONE_H}:flags=lanczos,setsar=1[seg${index}]`,
    )
  })
  let stitched = '[seg0]'
  let elapsed = segments[0].end - segments[0].start
  segments.slice(1).forEach((segment, index) => {
    const offset = elapsed - CUT_FADE
    const label = `[join${index}]`
    steps.push(
      `${stitched}[seg${index + 1}]xfade=transition=fade:duration=${CUT_FADE}:` +
        `offset=${offset.toFixed(3)}${label}`,
    )
    stitched = label
    elapsed = offset + (segment.end - segment.start)
  })

  steps.push(
    `${stitched}pad=${PHONE_W + BORDER * 2}:${PHONE_H + BORDER * 2}:${BORDER}:${BORDER}:${PRIMARY}[phone]`,
    `color=c=${INK}:s=${W}x${H}:r=25:d=${journey.toFixed(3)}[bg]`,
    `[bg][phone]overlay=x=(W-w)/2:y=${PHONE_Y}:shortest=1[stage]`,
    `[stage]${drawHook}[titled]`,
    `[titled]drawbox=x=0:y=${H - BAND_H}:w=${W}:h=${BAND_H}:color=0x000000@0.55:t=fill,${drawSubs}[body]`,
    `[1:v]fps=25,scale=${W}:${H},setsar=1,trim=duration=${END_SECONDS},setpts=PTS-STARTPTS[end]`,
    `[body][end]xfade=transition=fade:duration=${END_FADE}:offset=${(journey - END_FADE).toFixed(3)}[joined]`,
    `[joined]fade=t=in:st=0:d=0.3[outv]`,
    `[2:a]atrim=duration=${total.toFixed(3)},asetpts=PTS-STARTPTS,` +
      // `music.mjs` normalises every style to -6 dBFS, so one number works for
      // all of them: this lands the bed around -10, which is background music
      // under nothing else rather than a hum or a distraction.
      `afade=t=out:st=${Math.max(0, total - 1.6).toFixed(3)}:d=1.6,volume=0.6[outa]`,
  )

  /*
   * Silent unless a track is named.
   *
   * `music.mjs` can synthesise a bed and it is there for a quick preview, but
   * nothing built out of sine waves sounds like music under an advert, and a
   * repository that is public cannot carry somebody else's track. The bed
   * worth having is the one Instagram or TikTok adds from its own licensed
   * library at upload — which is also the only kind that cannot get the post
   * muted, and the kind those platforms push. `PROMO_MUSIC=/path/to.mp3` for
   * anything else, `PROMO_MUSIC_STYLE=warm|lofi|pulse` for the synthesised one.
   */
  const style = process.env.PROMO_MUSIC_STYLE
  const music =
    process.env.PROMO_MUSIC ??
    (style ? writeBed(total + 1, style) : 'anullsrc=channel_layout=stereo:sample_rate=48000')
  const synthesised = music.startsWith('anullsrc')
  if (!synthesised && !existsSync(music)) throw new Error(`no music at ${music}`)

  const out = join(OUT, `langx-promo-${LOCALE}.mp4`)
  const args = [
    '-y',
    '-i',
    join(RAW, 'journey.webm'),
    '-loop',
    '1',
    '-framerate',
    '25',
    '-t',
    String(END_SECONDS),
    '-i',
    join(OUT, 'endcard.png'),
    // `anullsrc` is a filter, not a file, so it needs `-f lavfi` in front of it.
    ...(synthesised ? ['-f', 'lavfi', '-i', music] : ['-i', music]),
    '-filter_complex',
    steps.join(';'),
    '-map',
    '[outv]',
    '-map',
    '[outa]',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '18',
    '-pix_fmt',
    'yuv420p',
    '-profile:v',
    'high',
    '-level',
    '4.0',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-shortest',
    '-movflags',
    '+faststart',
    out,
  ]

  const run = spawnSync(FFMPEG, args, { stdio: ['ignore', 'inherit', 'pipe'], encoding: 'utf8' })
  if (run.status !== 0) {
    console.error(run.stderr?.split('\n').slice(-25).join('\n'))
    throw new Error(`ffmpeg exited ${run.status}`)
  }
  console.log(`composed ${out} (${total.toFixed(1)}s)`)
}

main()
