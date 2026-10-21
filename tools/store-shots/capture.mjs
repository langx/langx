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
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { REPO } from './stack.mjs'
import { ORDER, SHOTS } from './shots.config.mjs'

const CHROME =
  process.env.SHOTS_CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
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
  mkdirSync(outDir, { recursive: true })
  const profile = join(outDir, '..', `.chrome-${cdpPort}`)
  rmSync(profile, { recursive: true, force: true })
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--hide-scrollbars',
      `--lang=${locale}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  )
  try {
    let target
    for (let i = 0; i < 60 && !target; i++) {
      await sleep(250)
      try {
        target = (await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json()).find(
          (t) => t.type === 'page',
        )
      } catch {
        // not listening yet
      }
    }
    if (!target) throw new Error('headless Chrome did not start')
    const ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((r) => ws.addEventListener('open', r, { once: true }))
    let seq = 0
    const pending = new Map()
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data)
      if (m.id && pending.has(m.id)) {
        pending.get(m.id)(m)
        pending.delete(m.id)
      }
    })
    const send = (method, params = {}) =>
      new Promise((r) => {
        const id = ++seq
        pending.set(id, r)
        ws.send(JSON.stringify({ id, method, params }))
      })
    const evaluate = async (expression) =>
      (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }))
        .result?.result?.value

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
    // The app reads the system language; first-run tours would cover the screen.
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `Object.defineProperty(navigator,'languages',{get:()=>['${locale}']});Object.defineProperty(navigator,'language',{get:()=>'${locale}'});try{for(const [k,v] of Object.entries(${JSON.stringify(QUIET)}))localStorage.setItem(k,v)}catch{}`,
    })

    // Kept across runs, so re-capturing one shot keeps the others' notes.
    const metaFile = join(outDir, 'meta.json')
    const meta = existsSync(metaFile) ? JSON.parse(readFileSync(metaFile, 'utf8')) : {}
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
        await evaluate(
          `localStorage.setItem('badgesSeen', ${JSON.stringify(JSON.stringify(seen))})`,
        )
        await send('Page.navigate', { url: ctx.webUrl + path })
        await sleep(shot.wait ?? 7000)
      }
      const cleanups = []
      for (const step of shot.steps ?? []) {
        if (step.ring) cleanups.push(await ring(ctx, step.ring))
        if (step.scroll) {
          await evaluate(
            `[...document.querySelectorAll('div')].filter((d)=>d.scrollHeight>d.clientHeight+50&&getComputedStyle(d).overflowY!=='visible').forEach((d)=>d.scrollBy(0,${step.scroll}))`,
          )
        }
        if (step.tap) {
          await evaluate(
            `(()=>{const e=[...document.querySelectorAll('div,span')].filter((e)=>(e.innerText||'').trim()===${JSON.stringify(step.tap)}).at(-1);e&&e.click()})()`,
          )
        }
        await sleep(step.wait ?? 2500)
      }
      /*
       * Where shot 9's no-prices variant cuts the screen, as a fraction of its
       * height: the first price on screen (a currency sign next to a digit), or,
       * where the build shows none (the web build sells nothing), just under the
       * compare table — the first tall filled block in the top half.
       */
      meta[id] = {
        cut: await evaluate(
          `(()=>{let best=null;const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode())){if(/[$€£¥₺₽]\\s?\\d|\\d\\s?[$€£¥₺₽]/.test(n.textContent)){const r=n.parentElement.getBoundingClientRect();if(r.height&&r.top>=0&&r.top<innerHeight&&(best===null||r.top<best))best=r.top}}if(best!==null)return {at:best/innerHeight,by:'price'};const block=[...document.querySelectorAll('div')].find((d)=>{const r=d.getBoundingClientRect(),c=getComputedStyle(d);return r.top<innerHeight/2&&r.height>innerHeight/4&&r.width>innerWidth*0.8&&c.backgroundColor!=='rgba(0, 0, 0, 0)'&&parseFloat(c.borderTopLeftRadius)>=8});return block?{at:(block.getBoundingClientRect().bottom+12)/innerHeight,by:'table'}:null})()`,
        ),
      }
      const shotPng = await send('Page.captureScreenshot', { format: 'png' })
      writeFileSync(join(outDir, `${id}.png`), Buffer.from(shotPng.result.data, 'base64'))
      for (const done of cleanups) await done()
      console.log(`  captured ${locale}/${id}`)
    }
    writeFileSync(metaFile, JSON.stringify(meta, null, 2))
    ws.close()
  } finally {
    // Through the handle this process holds — a failed shot must not leave a
    // headless Chrome holding the debugging port for the next run.
    chrome.kill()
    await sleep(500)
    rmSync(profile, { recursive: true, force: true })
  }
}
