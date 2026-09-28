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
  const outFile = resolve(a.out ?? join(HERE, 'out', `langx-reel-${aspect}.mp4`))
  mkdirSync(dirname(outFile), { recursive: true })

  const { browser, page, logs, info } = await openReel({ width: W, height: H, tc: false, format })
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

  const ffArgs = ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps)]
  ffArgs.push('-c:v', 'mjpeg', '-i', '-')
  if (wav) ffArgs.push('-ss', String(from), '-i', wav)
  ffArgs.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p')
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
    const jpeg = await page.screenshot({ type: 'jpeg', quality: 95 })
    if (!ff.stdin.write(jpeg)) await new Promise((r) => ff.stdin.once('drain', r))
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
