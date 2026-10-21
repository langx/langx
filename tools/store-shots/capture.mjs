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
import { REPO } from './stack.mjs'
import { launchChrome } from './chrome.mjs'
import { LOCALES, ORDER, SHOTS } from './shots.config.mjs'

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

/*
 * What runs in the page. These are never called in Node: `call` sends each
 * one's source and passes its values as arguments.
 */
/* global document, localStorage, getComputedStyle, innerHeight, innerWidth, NodeFilter */
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

export async function capture(ctx, { locale, outDir, ids = ORDER, cdpPort = 9370 }) {
  // The locale reaches Chrome's flags and the page, so only a known one does.
  if (!LOCALES.includes(locale)) throw new Error(`unknown locale ${locale}`)
  mkdirSync(outDir, { recursive: true })
  const browser = await launchChrome(cdpPort, [`--lang=${locale}`])
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
    // The app reads the system language: Accept-Language sets navigator.language.
    const { userAgent } = (await send('Browser.getVersion')).result
    await send('Network.setUserAgentOverride', { userAgent, acceptLanguage: locale })
    // First-run cards and tips would cover the screen. Device flags live in
    // the origin's localStorage, written once from a static file on it.
    await send('Page.navigate', { url: `${ctx.webUrl}/apple-touch-icon.png` })
    await sleep(1000)
    await call(setItems, QUIET)

    // Kept across runs, so re-capturing one shot keeps the others' notes.
    const metaFile = join(outDir, 'meta.json')
    let meta = {}
    try {
      meta = JSON.parse(readFileSync(metaFile, 'utf8'))
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    for (const id of ids) {
      const shot = SHOTS[id]
      await send('Network.clearBrowserCookies')
      for (const c of cookies)
        await send('Network.setCookie', { ...c, domain: 'localhost', path: '/' })
      const path = shot.path.replace('{anna}', ctx.world.annaConversation)
      await send('Page.navigate', { url: ctx.webUrl + path })
      await sleep(shot.wait ?? 7000)
      if (shot.newBadge) {
        // "New" is a device mark (`badgeSeen.ts`): every earned badge but one
        // is recorded as seen, so the shelf opens on that one.
        const res = await fetch(`${ctx.apiUrl}/me/badges?catalogue=v3`, {
          headers: {
            cookie: cookies.map((c) => `${c.name}=${c.value}`).join('; '),
            origin: ctx.webUrl,
          },
        })
        const earned = []
        JSON.stringify(await res.json(), (key, value) => {
          if (
            value &&
            typeof value === 'object' &&
            value.earned === true &&
            typeof value.id === 'string'
          )
            earned.push(value.id)
          return value
        })
        const seen = { userId: ctx.world.sofia, ids: earned.filter((b) => b !== shot.newBadge) }
        await call(setItems, { badgesSeen: JSON.stringify(seen) })
        await send('Page.navigate', { url: ctx.webUrl + path })
        await sleep(shot.wait ?? 7000)
      }
      const cleanups = []
      for (const step of shot.steps ?? []) {
        if (step.ring) cleanups.push(await ring(ctx, step.ring))
        if (step.scroll) await call(scrollLists, step.scroll)
        if (step.tap) await call(tapText, step.tap)
        await sleep(step.wait ?? 2500)
      }
      meta[id] = { cut: await call(findCut) }
      const shotPng = await send('Page.captureScreenshot', { format: 'png' })
      writeFileSync(join(outDir, `${id}.png`), Buffer.from(shotPng.result.data, 'base64'))
      for (const done of cleanups) await done()
      console.log(`  captured ${locale}/${id}`)
    }
    writeFileSync(metaFile, JSON.stringify(meta, null, 2))
  } finally {
    // Through the handle this process holds — a failed shot must not leave a
    // headless Chrome holding the debugging port for the next run.
    await browser.close()
  }
}
