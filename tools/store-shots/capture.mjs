/**
 * Photographs each shot's screen from the web build, signed in as @sofia, in
 * one locale, with headless Chrome over the DevTools protocol — no Playwright,
 * which this repo deliberately does not depend on.
 *
 * The viewport is the iPhone 17 Pro Max's in points (440 wide) at 3×, so a
 * capture is exactly the 6.9″ slot's 1320 px wide and is never scaled up.
 * Its height leaves out the status bar: the web build has none, and the
 * composer draws one (9:41, full battery) above the capture.
 */
import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { VENUS_STORY_MEDIA } from '../../packages/shared/src/venusStory.ts'
import { REPO, TIMEZONE } from './stack.mjs'
import { launchChrome } from './chrome.mjs'
import { LOCALES, ORDER, PPO, SHOTS } from './shots.config.mjs'

export const VIEWPORT = { width: 440, height: 956 - 62, scale: 3 }
/**
 * Device flags that keep first-run cards and tips off the screen. A store
 * picture shows the screen as somebody who uses the app sees it.
 */
const QUIET = {
  tips: JSON.stringify({ enabled: false }),
  discoverTourSeen: '1',
  introSeen: '1',
  onboardingPaywallShown: '1',
  firstReplyCardShown: '1',
  photoNudgeDismissed: '1',
  pushAsked: '1',
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
/** How long a shot waits for its images and videos before it is taken anyway. */
const MEDIA_WAIT = 90_000

/*
 * What runs in the page. These are never called in Node: `call` sends each
 * one's source and passes its values as arguments.
 */
/* global document, localStorage, getComputedStyle, innerHeight, innerWidth, NodeFilter, navigator */
function setItems(items) {
  for (const [key, value] of Object.entries(items)) localStorage.setItem(key, value)
}
function scrollLists(by) {
  for (const d of document.querySelectorAll('div')) {
    if (d.scrollHeight > d.clientHeight + 50 && getComputedStyle(d).overflowY !== 'visible') {
      d.scrollBy(0, by)
    }
  }
}
/*
 * Holds every video on the frame `at` seconds in: a playing video is caught
 * wherever its loading left it, so each locale would show a different moment.
 *
 * As a phone shows it, not as a browser does. The web player starts muted
 * and says "Tap for sound"; native starts with sound and shows no such pill,
 * and a paused player draws a play sign. So the video plays on, unmuted (the
 * capture's browser lifts the autoplay rule), at the slowest rate a browser
 * allows — its frame barely moves before the shot is taken.
 */
function seekVideos(at) {
  return Promise.all(
    [...document.querySelectorAll('video')].map(
      (v) =>
        new Promise((done) => {
          v.muted = false
          v.playbackRate = 0.0625
          v.addEventListener('seeked', done, { once: true })
          setTimeout(done, 5000)
          v.currentTime = at
          v.play().catch(() => {})
        }),
    ),
  )
}
/*
 * Scrolls the screen until the first image whose address holds `src` sits
 * `top` px from the top — a place in the screen that stays put in every
 * locale, where a scroll by pixels lands wherever the words above it wrap.
 */
function revealImage(src, top) {
  const img = [...document.querySelectorAll('img')].find((i) => i.src.includes(src))
  let list = img?.parentElement
  while (
    list &&
    !(list.scrollHeight > list.clientHeight + 50 && getComputedStyle(list).overflowY !== 'visible')
  )
    list = list.parentElement
  if (!list) return false
  list.scrollBy(0, img.getBoundingClientRect().top - top)
  return true
}
/*
 * How many images and videos on screen have not drawn yet. Venus's covers
 * and videos come from the media bucket, and on a slow connection a fixed
 * wait photographed grey tiles and a buffering spinner where they go.
 */
function mediaPending() {
  // On screen only: a strip's covers past its edge load lazily, never here.
  const seen = (el) => {
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight
  }
  const images = [...document.querySelectorAll('img')].filter(
    (i) => i.src && seen(i) && !(i.complete && i.naturalWidth > 0),
  )
  const videos = [...document.querySelectorAll('video')].filter(
    (v) => v.readyState < 2 || v.seeking,
  )
  return images.length + videos.length
}
function isOnline() {
  return navigator.onLine
}
function hasVideo() {
  return document.querySelector('video') !== null
}
function tapText(text) {
  const all = [...document.querySelectorAll('div,span')]
  const el = all.filter((e) => (e.innerText || '').trim() === text).at(-1)
  if (el) el.click()
}
/*
 * Where shot 9's no-prices variant cuts the screen, as a fraction of its
 * height: the first price on screen (a currency sign next to a digit), or,
 * where the build shows none (the web build sells nothing), just under the
 * compare table — the first tall filled block in the top half.
 */
function findCut() {
  let best = null
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (/[$€£¥₺₽]\s?\d|\d\s?[$€£¥₺₽]/.test(n.textContent)) {
      const r = n.parentElement.getBoundingClientRect()
      if (r.height && r.top >= 0 && r.top < innerHeight && (best === null || r.top < best))
        best = r.top
    }
  }
  if (best !== null) return { at: best / innerHeight, by: 'price' }
  const block = [...document.querySelectorAll('div')].find((d) => {
    const r = d.getBoundingClientRect()
    const c = getComputedStyle(d)
    return (
      r.top < innerHeight / 2 &&
      r.height > innerHeight / 4 &&
      r.width > innerWidth * 0.8 &&
      c.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
      parseFloat(c.borderTopLeftRadius) >= 8
    )
  })
  return block
    ? { at: (block.getBoundingClientRect().bottom + 12) / innerHeight, by: 'table' }
    : null
}
const mobileRequire = createRequire(join(REPO, 'apps/mobile/package.json'))

/*
 * Venus's videos are read straight from the public bucket, and the bucket
 * answers CORS for the app's own origins only. From the stack's localhost the
 * manifest request fails, and the app then draws no video anywhere — exactly
 * as it does when the bucket is out of reach — so the shots would show 3.1
 * without its videos. The capture reads the manifest itself and hands it to
 * the page with the stack's origin allowed. The covers and the videos are
 * plain media loads and need no such help. Read-only: nothing is written to
 * the bucket.
 */
const VENUS_MANIFEST = `${VENUS_STORY_MEDIA.baseUrl}/${VENUS_STORY_MEDIA.manifest}`
let venusManifest = null

async function serveVenusManifest(browser, webUrl) {
  if (!venusManifest) {
    const res = await fetch(VENUS_MANIFEST)
    if (!res.ok) throw new Error(`Venus manifest: HTTP ${res.status}`)
    venusManifest = Buffer.from(await res.arrayBuffer()).toString('base64')
  }
  browser.on('Fetch.requestPaused', ({ requestId, request }) =>
    request.url === VENUS_MANIFEST
      ? browser.send('Fetch.fulfillRequest', {
          requestId,
          responseCode: 200,
          responseHeaders: [
            { name: 'content-type', value: 'application/json' },
            { name: 'access-control-allow-origin', value: webUrl },
          ],
          body: venusManifest,
        })
      : browser.send('Fetch.continueRequest', { requestId }),
  )
  await browser.send('Fetch.enable', { patterns: [{ urlPattern: VENUS_MANIFEST }] })
}

async function signIn(apiUrl, webUrl, email, password) {
  const res = await fetch(`${apiUrl}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: webUrl },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(`sign-in ${email}: ${res.status}`)
  return res.headers.getSetCookie().map((c) => {
    const pair = c.split(';')[0]
    const i = pair.indexOf('=')
    return { name: pair.slice(0, i), value: pair.slice(i + 1) }
  })
}

/** Anna rings Sofia through the real socket, as her phone would. */
async function ring(ctx, media) {
  const { io } = mobileRequire('socket.io-client')
  const cookies = await signIn(
    ctx.apiUrl,
    ctx.webUrl,
    ctx.world.email.replace('sofia', 'demo_anna'),
    ctx.world.password,
  )
  const socket = io(ctx.apiUrl, {
    transports: ['websocket'],
    auth: { cookie: cookies.map((c) => `${c.name}=${c.value}`).join('; ') },
    extraHeaders: { origin: ctx.webUrl },
  })
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve)
    socket.once('connect_error', reject)
  })
  const callId = randomUUID()
  const ack = await new Promise((resolve) =>
    socket.emit(
      'call:start',
      { callId, conversationId: ctx.world.annaConversation, media },
      resolve,
    ),
  )
  if (!ack?.ok) throw new Error(`call:start refused: ${JSON.stringify(ack)}`)
  // Hung up before the next shot, or it rings over every screen after it.
  return () =>
    new Promise((resolve) => socket.emit('call:end', { callId, reason: 'user' }, resolve)).then(
      () => {
        socket.close()
        return sleep(1500)
      },
    )
}

export async function capture(ctx, { locale, outDir, ids = [...ORDER, ...PPO], cdpPort = 9370 }) {
  // The locale reaches Chrome's flags and the page, so only a known one does.
  if (!LOCALES.includes(locale)) throw new Error(`unknown locale ${locale}`)
  mkdirSync(outDir, { recursive: true })
  const browser = await launchChrome(cdpPort, [
    `--lang=${locale}`,
    // Venus's video plays with sound in the shot, as it starts on a phone.
    '--autoplay-policy=no-user-gesture-required',
  ])
  const { send, call } = browser
  try {
    const cookies = await signIn(ctx.apiUrl, ctx.webUrl, ctx.world.email, ctx.world.password)
    await send('Page.enable')
    await send('Network.enable')
    await send('Emulation.setDeviceMetricsOverride', {
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      deviceScaleFactor: VIEWPORT.scale,
      mobile: true,
    })
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
    await send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: 'light' }],
    })
    await send('Emulation.setLocaleOverride', { locale })
    /*
     * The seed's zone (`TIMEZONE`). The app sends the device's zone and the
     * API counts the day in it, so a browser left on the machine's own moved
     * "today" under the seed — the streak's counted day, and with it whether
     * today's Venus video was the one already seen.
     */
    await send('Emulation.setTimezoneOverride', { timezoneId: TIMEZONE })
    // The app reads the system language: Accept-Language sets navigator.language.
    const { userAgent } = (await send('Browser.getVersion')).result
    await send('Network.setUserAgentOverride', { userAgent, acceptLanguage: locale })
    // First-run cards and tips would cover the screen. Device flags live in
    // the origin's localStorage, written once from a static file on it.
    await send('Page.navigate', { url: `${ctx.webUrl}/apple-touch-icon.png` })
    await sleep(1000)
    await call(setItems, QUIET)
    await serveVenusManifest(browser, ctx.webUrl)
    /*
     * Today's Venus video opens by itself once per account per counted day,
     * over whichever screen comes first. Marked as already opened today, so
     * it stays shut except in the shot that asks for it (`venusPlayer`).
     */
    const tokens = await fetch(`${ctx.apiUrl}/me/tokens`, {
      headers: {
        cookie: cookies.map((c) => `${c.name}=${c.value}`).join('; '),
        origin: ctx.webUrl,
      },
    })
    const today = (await tokens.json())?.streak?.lastQualifiedDay
    if (!tokens.ok || !today) throw new Error(`/me/tokens: ${tokens.status}, no counted day`)
    const venusSeen = JSON.stringify({ [ctx.world.sofia]: today })
    await call(setItems, { venusStorySeen: venusSeen })

    // Kept across runs, so re-capturing one shot keeps the others' notes.
    const metaFile = join(outDir, 'meta.json')
    let meta = {}
    try {
      meta = JSON.parse(readFileSync(metaFile, 'utf8'))
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    for (const id of ids) {
      /*
       * Up to three tries. The machine's own connection drops now and then,
       * and the app then draws its offline banner over the screen; Venus's
       * media can also fail to arrive in time. Either way the shot is taken
       * again rather than kept.
       */
      for (let attempt = 1; ; attempt++) {
        const shot = SHOTS[id]
        await send('Network.clearBrowserCookies')
        for (const c of cookies)
          await send('Network.setCookie', { ...c, domain: 'localhost', path: '/' })
        const path = shot.path.replace('{anna}', ctx.world.annaConversation)
        // `venusPlayer`: the shot is today's video, opening by itself as it
        // does the first time a counted day is seen.
        await call(setItems, { venusStorySeen: shot.venusPlayer ? '{}' : venusSeen })
        await send('Page.navigate', { url: ctx.webUrl + path })
        await sleep(shot.wait ?? 7000)
        const cleanups = []
        for (const step of shot.steps ?? []) {
          if (step.ring) cleanups.push(await ring(ctx, step.ring))
          if (step.scroll) await call(scrollLists, step.scroll)
          if (step.tap) await call(tapText, step.tap)
          if (step.seek !== undefined) await call(seekVideos, step.seek)
          if (step.reveal && !(await call(revealImage, step.reveal.src, step.reveal.top)))
            throw new Error(`${locale}/${id}: no image from ${step.reveal.src} to scroll to`)
          await sleep(step.wait ?? 2500)
        }
        let pending = await call(mediaPending)
        for (let waited = 0; pending > 0 && waited < MEDIA_WAIT; waited += 500) {
          await sleep(500)
          pending = await call(mediaPending)
        }
        if (pending === 0) await sleep(1000) // the fade-in once they have
        const online = await call(isOnline)
        // A Venus shot whose player never opened is a picture of Home.
        const player = !shot.venusPlayer || (await call(hasVideo))
        meta[id] = { cut: await call(findCut) }
        const shotPng = await send('Page.captureScreenshot', { format: 'png' })
        writeFileSync(join(outDir, `${id}.png`), Buffer.from(shotPng.result.data, 'base64'))
        for (const done of cleanups) await done()
        if ((online && pending === 0 && player) || attempt === 3) {
          if (!online)
            console.warn(`  ! ${locale}/${id}: taken offline — the app's banner is in it`)
          if (!player) console.warn(`  ! ${locale}/${id}: Venus's player never opened`)
          if (pending > 0)
            console.warn(`  ! ${locale}/${id}: ${pending} image(s) or video(s) still loading`)
          break
        }
        console.warn(
          `  retry ${locale}/${id}: online ${online}, ${pending} loading, player ${player}`,
        )
      }
      console.log(`  captured ${locale}/${id}`)
    }
    writeFileSync(metaFile, JSON.stringify(meta, null, 2))
  } finally {
    // Through the handle this process holds — a failed shot must not leave a
    // headless Chrome holding the debugging port for the next run.
    await browser.close()
  }
}
