/**
 * Cuts `out/raw/journey.webm` into the finished 1080x1920 video.
 *
 * Nothing here is hand-timed: the trim points and every caption window come
 * out of `marks.json`, which `capture.mjs` measured while it recorded.
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
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const RAW = join(HERE, 'out/raw')
const OUT = join(HERE, 'out')
const FONTS = join(HERE, '../../apps/api/assets/fonts')
const BOLD = join(FONTS, 'Nunito_800ExtraBold.ttf')
const SEMI = join(FONTS, 'Nunito_600SemiBold.ttf')

const LOCALE = process.argv[2] ?? 'en'
const FFMPEG = process.env.FFMPEG_PATH ?? 'ffmpeg'

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

function marksFor() {
  const { marks } = JSON.parse(readFileSync(join(RAW, 'marks.json'), 'utf8'))
  const at = (name) => {
    const found = marks.find((mark) => mark.name === name)
    if (!found) throw new Error(`no mark "${name}" in marks.json`)
    return found.at
  }
  return { at, start: at('journeyStart'), end: at('journeyEnd') }
}

/** A caption's own file, so nothing in the copy has to be escaped. */
function textfile(name, body) {
  const path = join(RAW, `${name}.txt`)
  writeFileSync(path, body)
  return path
}

function main() {
  const copy = JSON.parse(readFileSync(join(HERE, 'captions.json'), 'utf8'))[LOCALE]
  if (!copy) throw new Error(`captions.json has no "${LOCALE}"`)
  const { at, start, end } = marksFor()
  const journey = end - start
  const total = journey + END_SECONDS

  mkdirSync(OUT, { recursive: true })
  const hook = copy.hook.map((line, index) => textfile(`hook${index + 1}`, line))

  // Each caption runs from its own mark to the next one's, the last to the end.
  const windows = copy.subtitles.map((caption, index) => ({
    file: textfile(`sub${index + 1}`, caption.text),
    from: Math.max(0, at(caption.from) - start),
    to: index + 1 < copy.subtitles.length ? at(copy.subtitles[index + 1].from) - start : journey,
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

  const filter = [
    // The recording: trimmed to the journey, framed, and never upscaled.
    `[0:v]trim=start=${start.toFixed(3)}:end=${end.toFixed(3)},setpts=PTS-STARTPTS,fps=25,` +
      `scale=-2:${PHONE_H}:flags=lanczos,setsar=1,` +
      `pad=${PHONE_W + BORDER * 2}:${PHONE_H + BORDER * 2}:${BORDER}:${BORDER}:${PRIMARY}[phone]`,
    `color=c=${INK}:s=${W}x${H}:r=25:d=${journey.toFixed(3)}[bg]`,
    `[bg][phone]overlay=x=(W-w)/2:y=${PHONE_Y}:shortest=1[stage]`,
    `[stage]${drawHook}[titled]`,
    `[titled]drawbox=x=0:y=${H - BAND_H}:w=${W}:h=${BAND_H}:color=0x000000@0.55:t=fill,${drawSubs}[body]`,
    // The end card is a still; `concat` needs it at the same size, rate and SAR.
    `[1:v]fps=25,scale=${W}:${H},setsar=1,trim=duration=${END_SECONDS},setpts=PTS-STARTPTS[end]`,
    `[body][end]concat=n=2:v=1:a=0,fade=t=in:st=0:d=0.3[outv]`,
    // Silent, but present: some upload paths mishandle a video-only MP4.
    `[2:a]atrim=duration=${total.toFixed(3)},asetpts=PTS-STARTPTS[outa]`,
  ].join(';')

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
    '-f',
    'lavfi',
    '-i',
    'anullsrc=channel_layout=stereo:sample_rate=48000',
    '-filter_complex',
    filter,
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
    '96k',
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
