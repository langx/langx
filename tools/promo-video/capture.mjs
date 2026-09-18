/**
 * Records one scripted run through the app: Discover, a profile, a first
 * message. Output is `out/raw/journey.webm` and `out/raw/marks.json`.
 *
 * The marks are the point. Every caption window and both trim points in
 * `compose.mjs` are computed from the times measured here, so the cut survives
 * the app getting faster or slower instead of needing its numbers retuned by
 * hand after every run.
 *
 * What it records is the real app against a real API — the local one. It must
 * never be pointed at production: the people on the Discover screen would be
 * real users who did not agree to appear in an advert. The fixtures it expects
 * are the ones `seed-test-users.ts` writes.
 *
 * Usage (see README.md for the stack it needs first):
 *   PROMO_PLAYWRIGHT=/path/to/node_modules/playwright/index.js \
 *     node tools/promo-video/capture.mjs
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const RAW = join(HERE, 'out/raw')
const CAPTIONS = JSON.parse(readFileSync(join(HERE, 'captions.json'), 'utf8'))

const WEB = process.env.PROMO_WEB ?? 'http://localhost:8081'
const API = process.env.PROMO_API ?? 'http://localhost:4000'
const EMAIL = process.env.PROMO_EMAIL ?? 'test_george@test.langx.invalid'
const PASSWORD = process.env.PROMO_PASSWORD ?? 'TestUser!2026'
/** Display name as Discover prints it; the capture clicks this. */
const PARTNER = process.env.PROMO_PARTNER ?? 'Katya'
/**
 * The same person's handle, used to warm their profile route.
 *
 * The camera handle, not the seeded one: `seed-promo-chat.ts` renames the cast
 * so a profile screen does not print `@test_katya` at the viewer. The email
 * address is unchanged, which is why `PROMO_PARTNER_EMAIL` below still builds
 * from the seeded name.
 */
const PARTNER_HANDLE = process.env.PROMO_PARTNER_HANDLE ?? 'katyadraws'
const PARTNER_EMAIL = process.env.PROMO_PARTNER_EMAIL ?? 'test_katya@test.langx.invalid'
/** How the viewer's row is labelled in the partner's chat list. */
const VIEWER_NAME = process.env.PROMO_VIEWER_NAME ?? 'George'

if (!/^https?:\/\/localhost[:/]/.test(API)) {
  throw new Error(`refusing to record against ${API} — the API must be localhost`)
}

/**
 * Playwright is not a dependency of this repo: it would put a browser download
 * into everyone's `pnpm install` for a script only run when a video is being
 * cut. Point `PROMO_PLAYWRIGHT` at one, or install it globally.
 */
async function loadChromium() {
  const specifier = process.env.PROMO_PLAYWRIGHT ?? 'playwright'
  const loaded = await import(specifier).catch(() => null)
  if (!loaded) {
    throw new Error(
      `cannot import "${specifier}" — install playwright (npm i -g playwright) or set ` +
        `PROMO_PLAYWRIGHT to the absolute path of its index.js`,
    )
  }
  // The package is CommonJS, so a dynamic import hands it back under `default`.
  return (loaded.default ?? loaded).chromium
}

/**
 * Everything that would otherwise walk into frame. All of them are plain
 * `localStorage` keys — `apps/mobile/src/lib/localFlags.ts`, `FLAG_KEYS` —
 * read at startup, so setting them before the first script runs is enough.
 */
function quietFirstRun() {
  localStorage.setItem('discoverTourSeen', '1')
  localStorage.setItem('introSeen', '1')
  // A promo run is not a user; keep it out of the product's own numbers.
  localStorage.setItem('analyticsOptOut', '1')
  localStorage.setItem('tips', JSON.stringify({ enabled: false, dismissed: {}, seen: {} }))
}

/**
 * Scroll from inside the page, one `requestAnimationFrame` at a time.
 *
 * `mouse.wheel` in a loop is a CDP round-trip per step and the jitter shows at
 * 25 fps; `scrollTo({ behavior: 'smooth' })` cannot be given a duration and
 * snaps. This is the only one of the three that is both even and as slow as a
 * thumb. Above roughly 600 px/s the virtualised list cannot mount rows fast
 * enough and blank ones slide past.
 */
async function glide(page, { distance, durationMs }) {
  await page.evaluate(
    ({ distance, durationMs }) =>
      new Promise((resolve) => {
        const scroller = [...document.querySelectorAll('div')]
          .filter((node) => node.scrollHeight > node.clientHeight + 50)
          .sort((a, b) => b.scrollHeight - a.scrollHeight)[0]
        if (!scroller) return resolve()
        const from = scroller.scrollTop
        const started = performance.now()
        const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
        const step = (now) => {
          const t = Math.min(1, (now - started) / durationMs)
          scroller.scrollTop = from + distance * ease(t)
          if (t < 1) requestAnimationFrame(step)
          else resolve()
        }
        requestAnimationFrame(step)
      }),
    { distance, durationMs },
  )
}

/**
 * Wait for the thing that proves the screen arrived, and say how long it took.
 * A screen that suddenly needs four seconds is the first sign that the next
 * video will have a skeleton in the middle of it.
 */
async function settled(page, locator, label) {
  const began = Date.now()
  try {
    await locator.waitFor({ state: 'visible', timeout: 30000 })
  } catch (caught) {
    // A run can be twenty minutes of stack; a picture of the screen it gave up
    // on is the difference between knowing why and guessing.
    const shot = join(RAW, `failed-${label.replace(/\W+/g, '-')}.png`)
    await page.screenshot({ path: shot }).catch(() => {})
    console.error(`  ${label} never painted — url ${page.url()}, screenshot ${shot}`)
    throw caught
  }
  console.log(`  ${label} painted in ${((Date.now() - began) / 1000).toFixed(2)}s`)
}

const CONTEXT = {
  viewport: { width: 400, height: 860 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: false,
  colorScheme: 'light',
  locale: 'en-US',
  // Fixed, so the timestamps in the chat are the same on every run.
  timezoneId: 'Europe/London',
}

async function signIn(context, email = EMAIL) {
  const response = await context.request.post(`${API}/api/auth/sign-in/email`, {
    headers: { origin: WEB },
    data: { email, password: PASSWORD },
  })
  if (!response.ok()) {
    throw new Error(`sign-in as ${email} failed: ${response.status()} ${await response.text()}`)
  }
}

/**
 * A throwaway pass that is not recorded.
 *
 * The first load of any route costs a fetch of a 6 MB bundle and the first
 * paint of a list that has never been laid out. Recorded, that is four blank
 * seconds at the head of the take. Done once in a context that is thrown away,
 * the recorded pass starts warm.
 */
async function warmUp(browser) {
  const context = await browser.newContext(CONTEXT)
  await context.addInitScript(quietFirstRun)
  await signIn(context)
  const page = await context.newPage()
  await page.goto(`${WEB}/discover`, { waitUntil: 'load', timeout: 240000 })
  await page.waitForTimeout(6000)
  await context.close()
}

/**
 * The other half of the conversation, in a second browser nobody records.
 *
 * A reply that appeared by writing to the database would be a picture of the
 * app rather than the app, and one faked in the page would be a lie about what
 * the product does. This is the partner signing in and typing, through the
 * same guards as anybody — which is also why it is slow, and why the wait for
 * it is one of the spans `compose.mjs` cuts.
 */
async function replyAsPartner(browser, text) {
  const context = await browser.newContext(CONTEXT)
  await context.addInitScript(quietFirstRun)
  await signIn(context, PARTNER_EMAIL)
  const page = await context.newPage()
  try {
    await page.goto(`${WEB}/chats`, { waitUntil: 'load', timeout: 240000 })
    await page.getByText(VIEWER_NAME, { exact: false }).first().click({ timeout: 60000 })
    await page.waitForURL(/\/chat\//, { timeout: 30000 })
    const composer = page.locator('textarea').last()
    await composer.click({ timeout: 30000 })
    await composer.fill(text)
    await page
      .getByRole('button', { name: /^Send$/i })
      .last()
      .click({ timeout: 15000 })
    await page.getByText(text).last().waitFor({ timeout: 30000 })
  } finally {
    await context.close()
  }
}

async function main() {
  const chromium = await loadChromium()
  rmSync(RAW, { recursive: true, force: true })
  mkdirSync(RAW, { recursive: true })

  /*
   * The system Chrome, so no browser has to be downloaded for one video;
   * PROMO_CHANNEL=chromium uses Playwright's own build instead.
   *
   * `--force-device-scale-factor=2` is what makes the recording sharp, and it
   * is not the same thing as the context's `deviceScaleFactor`. The context
   * option scales what the page *renders*; the screencast that Playwright
   * records from still hands over CSS-sized frames, so a 400-wide viewport
   * arrives 400 wide and Playwright pads the rest of the requested 800 with
   * flat gray. The launch flag moves the whole browser to 2x, and the frames
   * arrive at 800. Change either one and `verify.mjs` fails on the gray.
   */
  const browser = await chromium.launch({
    channel: process.env.PROMO_CHANNEL ?? 'chrome',
    args: ['--force-device-scale-factor=2'],
  })
  console.log('warming up…')
  await warmUp(browser)

  const context = await browser.newContext({
    ...CONTEXT,
    // Explicit, and twice the viewport: left out, Playwright shrinks the
    // recording to fit 800px and the phone arrives soft.
    recordVideo: { dir: RAW, size: { width: 800, height: 1720 } },
  })
  await context.addInitScript(quietFirstRun)
  await signIn(context)

  const page = await context.newPage()
  page.on('console', (message) => {
    if (message.type() === 'error') console.log('page error:', message.text().slice(0, 200))
  })

  const started = Date.now()
  const marks = []
  const mark = (name) => {
    marks.push({ name, at: (Date.now() - started) / 1000 })
    console.log(`mark ${name} @ ${marks.at(-1).at.toFixed(2)}s`)
  }

  /*
   * Walk the journey's routes once before the clock starts.
   *
   * Every screen the capture visits for the first time shows its skeleton
   * while the route's chunk is fetched, and two seconds of grey placeholder is
   * a long time in a twenty-second video. Doing it here rather than in the
   * warm-up context is deliberate: a context has its own cache, so warming one
   * does nothing for the other. These loads are recorded and then trimmed —
   * `journeyStart` is marked after them.
   */
  for (const route of [`/profile/${PARTNER_HANDLE}`, '/chats']) {
    await page.goto(`${WEB}${route}`, { waitUntil: 'load', timeout: 240000 })
    await page.waitForTimeout(2500)
  }
  /*
   * And into the thread itself, which `goto` cannot reach without its id.
   *
   * This is the one that matters: the drawing in the conversation is fetched
   * from the media host, and without a pass to put it in the browser's cache
   * the recorded run opens the chat on a grey rectangle where the picture goes.
   */
  await page.getByText(PARTNER, { exact: true }).first().click({ timeout: 30000 })
  await page.waitForURL(/\/chat\//, { timeout: 30000 })
  await page.waitForTimeout(3500)
  await page.goto(`${WEB}/discover`, { waitUntil: 'load', timeout: 240000 })
  await page.waitForTimeout(2500)
  await page.getByText('For you').first().waitFor({ timeout: 60000 })
  await page.waitForTimeout(1500)
  mark('journeyStart')

  await page.waitForTimeout(700)
  await glide(page, { distance: 820, durationMs: 1600 })
  await page.waitForTimeout(500)
  await glide(page, { distance: 560, durationMs: 1200 })
  await page.waitForTimeout(500)
  mark('scrolled')

  mark('profileClicked')
  await page.getByText(PARTNER, { exact: true }).first().click({ timeout: 15000 })
  await page.waitForURL(/\/profile\//, { timeout: 30000 })
  // The skeleton, not the screen, is what a fixed wait would have caught — and
  // marking the paint is what lets `compose.mjs` cut the skeleton out.
  await settled(page, page.getByText('Teaches', { exact: false }).first(), 'profile')
  mark('profilePainted')
  await page.waitForTimeout(1200)

  // Down past the languages and the bio — which is also what puts the fixture
  // handle out of frame and brings the call to action into it.
  await glide(page, { distance: 520, durationMs: 1300 })
  await page.waitForTimeout(700)

  mark('chatOpenClicked')
  await page
    .getByText(/Open your chat|Send a message/i)
    .last()
    .click({ timeout: 15000 })
  await page.waitForURL(/\/chat\//, { timeout: 30000 })
  /*
   * A line from the seeded thread, not the composer: the screen underneath is
   * still mounted, so a `textarea` or a placeholder locator is satisfied before
   * this chat has painted a single message.
   */
  await settled(page, page.getByText(CAPTIONS.en.chatMarker).last(), 'chat')
  mark('chatPainted')
  await page.waitForTimeout(700)

  // Up through the history and back down: the correction, the voice note and
  // the drawing are what the middle of this video is for.
  await glide(page, { distance: -1500, durationMs: 2000 })
  await page.waitForTimeout(500)
  await glide(page, { distance: 1500, durationMs: 1500 })
  await page.waitForTimeout(400)

  const composer = page.locator('textarea').last()
  await composer.click({ timeout: 15000 })
  // Chrome underlines "Katya" in red otherwise, which is the browser showing
  // through a video that is meant to be a phone.
  await page.evaluate(() => {
    document.querySelectorAll('textarea, input').forEach((node) => {
      node.spellcheck = false
    })
  })
  await page.keyboard.type(CAPTIONS.en.message, { delay: 62 })
  await page.waitForTimeout(500)
  // The same instant as the end of typing; named for what happens next,
  // because `compose.mjs` cuts the wait that follows it.
  mark('sendClicked')
  await page
    .getByRole('button', { name: /^Send$/i })
    .last()
    .click({ timeout: 15000 })
  /*
   * Wait for the bubble, not for a guess at how long it takes.
   *
   * The first message to somebody is what creates the conversation, so the
   * screen is replaced by the real one on a new route and spends a moment
   * empty. A fixed wait ended the video on that empty screen — the one frame
   * the whole video exists to earn.
   */
  await settled(page, page.getByText(CAPTIONS.en.message).last(), 'sent message')
  mark('delivered')
  await page.waitForTimeout(900)

  // Driving a second session takes the best part of a minute; the recording
  // holds on a still chat throughout, and the span is cut out afterwards.
  mark('awaitReply')
  await replyAsPartner(browser, CAPTIONS.en.reply)
  await settled(page, page.getByText(CAPTIONS.en.reply).last(), 'reply')
  mark('replied')
  await page.waitForTimeout(2200)
  mark('journeyEnd')

  const video = page.video()
  // Nothing is written until the context closes; `saveAs` waits for that.
  await context.close()
  await video.saveAs(join(RAW, 'journey.webm'))
  writeFileSync(join(RAW, 'marks.json'), `${JSON.stringify({ marks }, null, 2)}\n`)
  await browser.close()
  console.log(`captured ${join(RAW, 'journey.webm')}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
