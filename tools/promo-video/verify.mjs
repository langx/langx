/**
 * Checks the two things that go wrong silently, and builds a contact sheet
 * for the things only an eye catches.
 *
 * The gray check is the important one. When Chromium hands the recorder
 * frames smaller than the size it asked for, Playwright pads them with flat
 * mid-gray instead of failing — so the capture "succeeds", the compose step
 * scales the padding along with the app, and the phone in the finished video
 * is a small picture floating in a gray rectangle. Y=126 across a strip that
 * should hold a screen is that padding.
 *
 * Usage: node tools/promo-video/verify.mjs [locale]
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, 'out')
const RAW = join(OUT, 'raw')
const LOCALE = process.argv[2] ?? 'en'
const FFMPEG = process.env.FFMPEG_PATH ?? 'ffmpeg'
const FFPROBE = process.env.FFPROBE_PATH ?? 'ffprobe'

/** Playwright's own padding colour, as luma. */
const PAD_LUMA = 126

let failures = 0
function check(label, actual, expected) {
  const ok = String(actual) === String(expected)
  if (!ok) failures += 1
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}: ${actual}${ok ? '' : ` (expected ${expected})`}`)
}

function probe(file, entries) {
  const run = spawnSync(
    FFPROBE,
    ['-v', 'error', '-select_streams', 'v:0', '-show_entries', entries, '-of', 'json', file],
    { encoding: 'utf8' },
  )
  if (run.status !== 0) throw new Error(`ffprobe failed on ${file}: ${run.stderr}`)
  const parsed = JSON.parse(run.stdout)
  return { ...parsed.streams?.[0], ...parsed.format }
}

/** Mean luma of one column of one frame — flat 126 means padding. */
function luma(file, crop, seconds) {
  const run = spawnSync(
    FFMPEG,
    // prettier-ignore
    ['-v', 'info', '-ss', String(seconds), '-i', file, '-vf',
     `crop=${crop},signalstats,metadata=print:key=lavfi.signalstats.YAVG`,
     '-frames:v', '1', '-f', 'null', '-'],
    { encoding: 'utf8' },
  )
  const found = /YAVG=([0-9.]+)/.exec(run.stderr ?? '')
  return found ? Number(found[1]) : NaN
}

function main() {
  const journey = join(RAW, 'journey.webm')
  const finished = join(OUT, `langx-promo-${LOCALE}.mp4`)

  console.log('— raw recording —')
  const raw = probe(journey, 'stream=codec_name,width,height,r_frame_rate:format=duration')
  check('codec', raw.codec_name, 'vp8')
  check('size', `${raw.width}x${raw.height}`, '800x1720')
  check('rate', raw.r_frame_rate, '25/1')

  // The right-hand strip of a real screen is never one flat value.
  const edge = luma(journey, '40:1400:755:160', 3)
  const padded = Math.abs(edge - PAD_LUMA) < 0.5
  if (padded) failures += 1
  console.log(
    `${padded ? 'FAIL' : 'ok  '} right edge luma: ${edge.toFixed(1)}` +
      (padded ? ' — Playwright padding, the capture lost half its resolution' : ''),
  )

  // A recording that started before the app painted opens on white.
  const first = luma(journey, '760:1600:20:60', 0.2)
  const blank = first > 250
  if (blank) failures += 1
  console.log(`${blank ? 'FAIL' : 'ok  '} first frame luma: ${first.toFixed(1)}`)

  if (!existsSync(finished)) {
    console.log('\nno composed video yet — run compose.mjs')
    process.exit(failures === 0 ? 0 : 1)
  }

  console.log('\n— composed video —')
  const out = probe(
    finished,
    'stream=codec_name,width,height,r_frame_rate,pix_fmt,sample_aspect_ratio:format=duration,size',
  )
  check('codec', out.codec_name, 'h264')
  check('size', `${out.width}x${out.height}`, '1080x1920')
  check('rate', out.r_frame_rate, '25/1')
  check('pixel format', out.pix_fmt, 'yuv420p')
  check('sample aspect', out.sample_aspect_ratio ?? '1:1', '1:1')
  console.log(`     duration: ${Number(out.duration).toFixed(1)}s, ${out.size} bytes`)

  mkdirSync(join(OUT, 'frames'), { recursive: true })
  const sheet = join(OUT, 'frames', 'contact.png')
  spawnSync(FFMPEG, [
    '-y',
    '-v',
    'error',
    '-i',
    finished,
    '-vf',
    'fps=1,scale=270:480,tile=6x4',
    sheet,
  ])
  console.log(`\ncontact sheet: ${sheet} — open it and look at it.`)

  process.exit(failures === 0 ? 0 : 1)
}

main()
