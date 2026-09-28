/**
 * Renders the reel to an MP4, one seeked frame at a time.
 *
 * Real-time screen capture would drop frames exactly where the reel is
 * busiest, so this never plays the page: it seeks the master timeline to each
 * frame's time, screenshots it and pipes the frames to ffmpeg. The score is
 * rendered by the page itself through an OfflineAudioContext, from the same
 * cue list the live player schedules, so picture and sound cannot drift.
 *
 * Usage: node tools/showreel/render.mjs [--fps 60] [--format wide|vertical] [--from 0] [--to <end>] [--out <file>]
 *        (the default file is out/langx-reel-16x9.mp4, or -9x16 for --format vertical)
 *        node tools/showreel/render.mjs --audio-only 1     # just out/langx-reel.wav
 *
 *        node tools/showreel/render.mjs --page splash --format vertical [--crf 18] [--size 1080x1920]
 *        (the app's launch animation, out/langx-splash-9x16.mp4; see "The launch animation"
 *        in the README for what the app needs from that file)
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openReel } from './snap.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

function args() {
  const out = {}
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i += 2) out[argv[i].replace(/^--/, '')] = argv[i + 1]
  return out
}

async function main() {
  const a = args()
  const fps = Number(a.fps ?? 60)
  const format = a.format === 'vertical' ? 'vertical' : 'wide'
  const [W, H] = format === 'vertical' ? [1080, 1920] : [1920, 1080]
  const aspect = format === 'vertical' ? '9x16' : '16x9'
  const pageName = a.page ?? 'index'
  const splash = pageName === 'splash'
  const outFile = resolve(
    a.out ?? join(HERE, 'out', `langx-${splash ? 'splash' : 'reel'}-${aspect}.mp4`),
  )
  mkdirSync(dirname(outFile), { recursive: true })

  const { browser, page, logs, info } = await openReel({
    width: W,
    height: H,
    tc: false,
    format,
    page: pageName,
  })
  if (info.errors.length) console.warn(`page reported:\n  ${info.errors.join('\n  ')}`)
  const from = Number(a.from ?? 0)
  const to = Math.min(Number(a.to ?? info.duration), info.duration)
  const frames = Math.round((to - from) * fps)

  let wav = null
  const hasAudio = await page.evaluate(() => Boolean(window.REEL.audio))
  if (hasAudio) {
    console.log('rendering the score…')
    const b64 = await page.evaluate(() => window.REEL.audio.renderWav())
    wav = join(dirname(outFile), 'langx-reel.wav')
    writeFileSync(wav, Buffer.from(b64, 'base64'))
  }
  if (a['audio-only']) {
    await browser.close()
    console.log(wav ?? 'no score: REEL.audio is not set')
    return
  }

  /*
   * The splash is shipped inside the app, so it is encoded for delivery, not
   * as a master, and its first frame has to decode as the app's own #ffc409:
   * the app cuts to it from a view painted that colour.
   *
   * Its frames go through PNG rather than JPEG, because a JPEG round trip
   * moves a flat yellow by a step before the video encoder has touched it.
   * The matrix and primaries are BT.709 and the file says so. The transfer is
   * tagged sRGB (IEC 61966-2-1), not BT.709, because that is what the pixels
   * are — screenshots of a page — and because Apple's decoders act on it:
   * Chrome on a Mac, handing a 1080x1920 H.264 to VideoToolbox, drew the
   * BT.709-tagged file as 255,204,5, the untagged one the same, and the
   * sRGB-tagged one as 255,197,10 — one step from the view beside it. A small
   * file decoded in software showed 255,197,10 whatever the tag, which is why
   * testing this at a thumbnail's size says nothing.
   */
  const frameType = splash ? 'png' : 'jpeg'
  const ffArgs = ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps)]
  ffArgs.push('-c:v', splash ? 'png' : 'mjpeg', '-i', '-')
  if (wav) ffArgs.push('-ss', String(from), '-i', wav)
  if (splash) {
    const size = String(a.size ?? `${W}x${H}`).replace('x', ':')
    // setparams rather than -color_primaries and -color_trc: with ffmpeg 8
    // those two output flags did not reach the file, which came out with its
    // primaries and transfer marked unknown. ffprobe the result to check.
    const tags = 'setparams=range=tv:color_primaries=bt709:color_trc=iec61966-2-1:colorspace=bt709'
    const convert = `scale=${size}:flags=lanczos:out_color_matrix=bt709:out_range=tv`
    ffArgs.push('-vf', `${convert},format=yuv420p,${tags}`)
    ffArgs.push('-c:v', 'libx264', '-preset', 'veryslow', '-crf', String(a.crf ?? 18))
    ffArgs.push('-profile:v', 'high', '-level:v', '4.2', '-pix_fmt', 'yuv420p')
    ffArgs.push('-an')
  } else {
    ffArgs.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p')
  }
  if (wav) ffArgs.push('-c:a', 'aac', '-b:a', '192k', '-shortest')
  ffArgs.push('-movflags', '+faststart', outFile)
  const ff = spawn('ffmpeg', ffArgs, { stdio: ['pipe', 'inherit', 'inherit'] })
  const done = new Promise((resolveDone, reject) => {
    ff.on('exit', (code) =>
      code === 0 ? resolveDone() : reject(new Error(`ffmpeg exited ${code}`)),
    )
  })

  const started = Date.now()
  for (let i = 0; i < frames; i++) {
    await page.evaluate((t) => window.REEL.seek(t), from + i / fps)
    const frame = await page.screenshot(
      frameType === 'jpeg' ? { type: 'jpeg', quality: 95 } : { type: 'png' },
    )
    if (!ff.stdin.write(frame)) await new Promise((r) => ff.stdin.once('drain', r))
    if (i % fps === 0) {
      const rate = (i + 1) / ((Date.now() - started) / 1000)
      process.stdout.write(`\r${i}/${frames} frames, ${rate.toFixed(1)} fps   `)
    }
  }
  ff.stdin.end()
  await done
  await browser.close()
  process.stdout.write('\n')
  if (logs.length) console.warn(`console:\n  ${logs.join('\n  ')}`)
  console.log(outFile)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
