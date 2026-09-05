/**
 * Does `inverted` survive react-native-web?
 *
 * RNW implements it as `scaleY(-1)` on the scroller with a counter-transform
 * per cell. Everything below is a property that transform could plausibly
 * break: which way the wheel goes, whether text ends up mirrored, and whether
 * a page of history shifts what the reader is looking at.
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { chromium } from 'playwright'

const DIST = '../../apps/mobile/dist'
const PORT = 8090
const CONVERSATION = process.env.CONVERSATION_ID
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.ico': 'image/x-icon' }

/** Every exported route is the same SPA shell, so anything unknown gets it. */
const server = createServer(async (req, res) => {
  const path = decodeURIComponent((req.url ?? '/').split('?')[0])
  const file = join(DIST, normalize(path).replace(/^(\.\.[/\\])+/, ''))
  // Read first and let the error say what the path is, instead of stat-then-
  // read: a directory falls back to its index.html, a missing file to the
  // SPA entry (Expo's dynamic routes resolve client-side).
  const candidates = [file, join(file, 'index.html'), join(DIST, 'index.html')]
  let body = null
  let served = file
  for (const candidate of candidates) {
    try {
      body = await readFile(candidate)
      served = candidate
      break
    } catch {
      // try the next candidate
    }
  }
  if (body === null) {
    res.writeHead(404).end('not found')
    return
  }
  res.writeHead(200, { 'content-type': TYPES[extname(served)] ?? 'application/octet-stream' })
  res.end(body)
})
await new Promise((r) => server.listen(PORT, r))

const results = []
const check = (name, pass, detail) => {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 420, height: 860 } })
page.on('console', (m) => m.type() === 'error' && console.log('  [console]', m.text().slice(0, 160)))

try {
  await page.goto(`http://localhost:${PORT}/sign-in`, { waitUntil: 'networkidle' })
  await page.locator('input[autocomplete="email"], input[type="email"]').first()
    .fill('test_anna@test.langx.invalid')
  await page.locator('input[type="password"]').first().fill((process.env.TEST_PASSWORD ?? 'TestUser!2026'))
  await page.getByText('Sign in', { exact: true }).last().click()
  await page.waitForURL((u) => !u.pathname.includes('sign-in'), { timeout: 30_000 })

  await page.goto(`http://localhost:${PORT}/chat/${CONVERSATION}`, { waitUntil: 'networkidle' })
  await page.getByText('72.', { exact: false }).first().waitFor({ timeout: 30_000 })

  /** Cumulative scaleY from an element to the root: negative means mirrored. */
  const flipOf = (selectorText) =>
    page.evaluate((text) => {
      const el = [...document.querySelectorAll('div')]
        .filter((n) => n.textContent?.trim() === text && n.children.length === 0)
        .pop()
      if (!el) return null
      let scale = 1
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
        const t = getComputedStyle(n).transform
        if (t && t !== 'none') {
          const m = new DOMMatrix(t)
          scale *= m.d
        }
      }
      return scale
    }, selectorText)

  // 1. The thread opens on its newest message, with no scrolling.
  const newest = page.getByText('72.', { exact: false }).first()
  check('opens at the newest message', await newest.isVisible())

  // 2. Nothing the reader looks at may be mirrored.
  const scroller = page.locator('div').filter({ hasText: /^72\./ }).first()
  const box = await newest.boundingBox()
  check('newest message is in the lower half', box !== null && box.y > 430,
    box ? `y=${Math.round(box.y)}` : 'no box')

  // 3. Wheeling up must walk into history, not out of it.
  const topNumber = () =>
    page.evaluate(() => {
      const nums = [...document.querySelectorAll('div')]
        .filter((n) => n.children.length === 0 && /^\d+\. /.test(n.textContent ?? ''))
        .map((n) => ({ n: parseInt(n.textContent, 10), y: n.getBoundingClientRect().y }))
        .filter((x) => x.y > -50 && x.y < 900)
      return nums.length ? Math.min(...nums.map((x) => x.n)) : null
    })

  const before = await topNumber()
  await page.mouse.move(210, 430)
  await page.mouse.wheel(0, -1200)
  await page.waitForTimeout(700)
  const after = await topNumber()
  check('wheel up reveals older messages', before !== null && after !== null && after < before,
    `top ${before} → ${after}`)

  // 4. A page of history must not move what is on screen.
  const anchorText = await page.evaluate(() => {
    const el = [...document.querySelectorAll('div')]
      .filter((n) => n.children.length === 0 && /^\d+\. /.test(n.textContent ?? ''))
      .find((n) => n.getBoundingClientRect().y > 300)
    return el ? el.textContent : null
  })
  const anchorBefore = anchorText
    ? await page.getByText(anchorText, { exact: true }).first().boundingBox()
    : null

  for (let i = 0; i < 12; i++) {
    await page.mouse.wheel(0, -1500)
    await page.waitForTimeout(250)
  }
  await page.waitForTimeout(1200)
  const loaded = await page.evaluate(
    () =>
      [...document.querySelectorAll('div')].filter(
        (n) => n.children.length === 0 && /^\d+\. /.test(n.textContent ?? ''),
      ).length,
  )
  check('older pages load on reaching the end', loaded > 0, `${loaded} rows mounted`)

  const oldestSeen = await topNumber()
  check('paged past the first page of 30', oldestSeen !== null && oldestSeen < 43,
    `oldest visible: ${oldestSeen}`)

  // 5. The jump button is the way back.
  const jump = page.getByLabel(/Jump to/)
  // Headings only enter the viewport at a day boundary, which is why this is
  // checked here rather than on open.
  const headingText = await page.evaluate(() => {
    const el = [...document.querySelectorAll('div')].find(
      (n) => n.children.length === 0 && /^(Today|Yesterday|\d+ \w+)$/.test(n.textContent ?? ''),
    )
    return el ? el.textContent : null
  })
  const dayFlip = headingText ? await flipOf(headingText) : null
  check('date heading is on screen and upright', dayFlip !== null && dayFlip > 0,
    headingText ? `"${headingText}" scaleY=${dayFlip}` : 'no heading in view')

  const bodyFlip = await flipOf(await page.evaluate(() => {
    const el = [...document.querySelectorAll('div')].find(
      (n) => n.children.length === 0 && /^\d+\. /.test(n.textContent ?? ''),
    )
    return el ? el.textContent : ''
  }))
  check('message text is upright', bodyFlip !== null && bodyFlip > 0, `scaleY=${bodyFlip}`)

  check('jump button appears once scrolled away', await jump.isVisible().catch(() => false))
  await page.screenshot({ path: './inverted-scrolled.png' })

  if (await jump.isVisible().catch(() => false)) {
    await jump.click()
    await page.waitForTimeout(1200)
    check('jump returns to the newest message', await newest.isVisible())
  }
  await page.screenshot({ path: './inverted-bottom.png' })
} catch (error) {
  console.log('ERROR', error.message.slice(0, 400))
  await page.screenshot({ path: './inverted-error.png' }).catch(() => {})
  results.push({ name: 'run completed', pass: false })
} finally {
  await browser.close()
  server.close()
}

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
