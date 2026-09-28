/**
 * Contact sheets of the reel, for looking at motion without watching it.
 *
 * Seeks the page to a list of times, screenshots each, and tiles them into one
 * PNG with a burnt-in timecode per frame, so a scene can be judged from a
 * single image: where things are on each beat, whether a handoff lines up,
 * whether anything is clipped or late.
 *
 * Usage:
 *   node tools/showreel/snap.mjs --scene 03-hello [--n 16] [--cols 4]
 *   node tools/showreel/snap.mjs --from 10 --to 14 --n 12
 *   node tools/showreel/snap.mjs --times 0,4.5,9.99 --full      # 1920x1080 frames, no sheet
 *   node tools/showreel/snap.mjs --boundaries                    # last/first frame of every cut
 *
 * Prints the sheet's path and any build or draw error the page reported.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PAGE = pathToFileURL(join(HERE, 'src', 'index.html')).href

function args() {
  const out = {}
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '')
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) out[key] = true
    else {
      out[key] = next
      i++
    }
  }
  return out
}

async function loadChromium() {
  const specifier = process.env.REEL_PLAYWRIGHT ?? process.env.PROMO_PLAYWRIGHT ?? 'playwright'
  const loaded = await import(specifier).catch(() => null)
  if (!loaded) {
    throw new Error(
      `cannot import "${specifier}" — install playwright or set REEL_PLAYWRIGHT to its index.js`,
    )
  }
  return (loaded.default ?? loaded).chromium
}

export async function openReel({ width, height, tc = true }) {
  const chromium = await loadChromium()
  const browser = await chromium.launch({ channel: process.env.REEL_CHANNEL ?? 'chrome' })
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
  const logs = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning')
      logs.push(`${msg.type()}: ${msg.text()}`)
  })
  page.on('pageerror', (error) => logs.push(`pageerror: ${error.message}`))
  await page.goto(`${PAGE}?capture${tc ? '&tc' : ''}`, { waitUntil: 'load' })
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', null, {
    timeout: 30000,
  })
  const info = await page.evaluate(() => ({
    duration: window.REEL.duration,
    scenes: window.REEL.scenes.map((s) => ({ id: s.id, start: s.start, dur: s.dur })),
    errors: window.REEL.errors,
  }))
  return { browser, page, logs, info }
}

async function main() {
  const a = args()
  const full = Boolean(a.full)
  const width = full ? 1920 : 960
  const height = full ? 1080 : 540
  const { browser, page, logs, info } = await openReel({ width, height })
  const FRAME = 1 / 60

  let times = []
  let name = 'custom'
  if (a.times) {
    times = String(a.times).split(',').map(Number)
  } else if (a.boundaries) {
    name = 'boundaries'
    for (let i = 1; i < info.scenes.length; i++) {
      const cut = info.scenes[i].start
      times.push(cut - FRAME, cut)
    }
  } else {
    let from = Number(a.from ?? 0)
    let to = Number(a.to ?? info.duration)
    if (a.scene) {
      const s = info.scenes.find((x) => x.id === a.scene)
      if (!s)
        throw new Error(`no scene ${a.scene}; have ${info.scenes.map((x) => x.id).join(', ')}`)
      from = s.start
      to = s.start + s.dur - FRAME
      name = s.id
    }
    const n = Number(a.n ?? 16)
    for (let i = 0; i < n; i++) times.push(from + ((to - from) * i) / Math.max(1, n - 1))
  }

  // Several builders snap at once; the pid keeps their frames apart.
  const dir = join(HERE, 'out', 'snap', String(a.name ?? `${name}-${process.pid}`))
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  let i = 0
  for (const t of times) {
    await page.evaluate((time) => window.REEL.seek(time), t)
    await page.screenshot({ path: join(dir, `f${String(i).padStart(3, '0')}.png`) })
    i++
  }
  await browser.close()

  if (full) {
    console.log(`frames: ${dir}`)
  } else {
    const cols = Number(a.cols ?? 4)
    const rows = Math.ceil(times.length / cols)
    const sheet = join(dir, 'sheet.png')
    execFileSync('ffmpeg', [
      '-loglevel',
      'error',
      '-y',
      '-framerate',
      '1',
      '-i',
      join(dir, 'f%03d.png'),
      '-vf',
      `scale=480:-1,tile=${cols}x${rows}:padding=6:margin=6:color=0x444444`,
      '-frames:v',
      '1',
      sheet,
    ])
    console.log(`sheet: ${sheet}`)
  }
  const problems = [...info.errors, ...logs]
  if (problems.length) console.log(`page reported:\n  ${problems.join('\n  ')}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
