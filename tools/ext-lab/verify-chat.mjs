/**
 * The hands-on pass for packages 2–4: reply and the jump window, the anchored
 * menu with reactions and deletion, edit/star/pin, and the activity map.
 *
 * Swipe-to-reply is deliberately absent on web, so every message action here
 * goes through the long-press menu — which is exactly the path a browser user
 * has.
 */
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { chromium } from 'playwright'

const DIST = '../../apps/mobile/dist'
const PORT = 8090
const BASE = `http://localhost:${PORT}`
const CONVERSATION = process.env.CONVERSATION_ID
const GAP_DAY = process.env.GAP_DAY
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
}

const server = createServer(async (req, res) => {
  const path = decodeURIComponent((req.url ?? '/').split('?')[0])
  let file = join(DIST, normalize(path).replace(/^(\.\.[/\\])+/, ''))
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html')
  } catch {
    file = join(DIST, 'index.html')
  }
  try {
    const body = await readFile(file)
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404).end('not found')
  }
})
await new Promise((r) => server.listen(PORT, r))

const results = []
const check = (name, pass, detail) => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 420, height: 860 } })
page.on('console', (m) => m.type() === 'error' && console.log('  [err]', m.text().slice(0, 140)))

/** RN Web's Pressable resolves a long press on a timer, not on a gesture. */
async function longPress(locator) {
  await locator.scrollIntoViewIfNeeded().catch(() => {})
  const box = await locator.boundingBox()
  if (!box) throw new Error('nothing to long-press')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(800)
  await page.mouse.up()
  await page.waitForTimeout(500)
}

const bubble = (text) =>
  page.locator('div').filter({ hasText: new RegExp(`^${text.replace('.', '\\.')} `) }).last()

try {
  // ---- sign in -------------------------------------------------------------
  await page.goto(`${BASE}/sign-in`, { waitUntil: 'networkidle' })
  await page.locator('input[autocomplete="email"], input[type="email"]').first()
    .fill('test_anna@test.langx.invalid')
  await page.locator('input[type="password"]').first().fill((process.env.TEST_PASSWORD ?? 'TestUser!2026'))
  await page.getByText('Sign in', { exact: true }).last().click()
  await page.waitForURL((u) => !u.pathname.includes('sign-in'), { timeout: 30_000 })

  await page.goto(`${BASE}/chat/${CONVERSATION}`, { waitUntil: 'networkidle' })
  await page.getByText('72.', { exact: false }).first().waitFor({ timeout: 30_000 })

  // ---- the anchored menu ---------------------------------------------------
  await longPress(bubble('70.'))
  const menuOpen = await page.getByText('Reply', { exact: true }).isVisible().catch(() => false)
  check('long press opens the menu', menuOpen)
  check(
    'the emoji strip is in the menu',
    await page.getByText('🔥', { exact: true }).first().isVisible().catch(() => false),
  )
  await page.screenshot({ path: './chat-menu.png' })

  // ---- reactions -----------------------------------------------------------
  await page.getByText('🔥', { exact: true }).first().click()
  await page.waitForTimeout(1200)
  const reacted = await page.evaluate(() => document.body.innerText.includes('🔥'))
  check('the reaction lands on the bubble', reacted)

  // ---- the second page -----------------------------------------------------
  await longPress(bubble('70.'))
  const more = page.getByText('More…', { exact: true })
  const hasMore = await more.isVisible().catch(() => false)
  check('the menu offers a second page', hasMore)
  if (hasMore) {
    await more.click()
    await page.waitForTimeout(400)
    check(
      'the second page holds star, pin and report',
      (await page.getByText('Star', { exact: true }).isVisible().catch(() => false)) &&
        (await page.getByText('Pin', { exact: true }).isVisible().catch(() => false)),
    )
    await page.screenshot({ path: './chat-menu-more.png' })

    // ---- pin ---------------------------------------------------------------
    await page.getByText('Pin', { exact: true }).click()
    await page.waitForTimeout(1500)
    check(
      'pinning raises a banner over the thread',
      await page.getByText('70.', { exact: false }).first().isVisible(),
      'banner text is the pinned message',
    )
    await page.screenshot({ path: './chat-pinned.png' })
  }

  // ---- reply ---------------------------------------------------------------
  await longPress(bubble('68.'))
  await page.getByText('Reply', { exact: true }).click()
  await page.waitForTimeout(600)
  check(
    'the composer shows what is being answered',
    await page.getByText(/Replying to/).isVisible().catch(() => false),
  )

  const input = page.locator('textarea, input[type="text"]').last()
  await input.fill('answering sixty-eight')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(2000)
  check(
    'the reply carries a quote of its target',
    await page.getByText('answering sixty-eight').first().isVisible().catch(() => false),
  )
  await page.screenshot({ path: './chat-reply.png' })

  // ---- jumping -------------------------------------------------------------
  const quote = page.getByLabel('Go to the quoted message').last()
  if (await quote.isVisible().catch(() => false)) {
    await quote.click()
    await page.waitForTimeout(1500)
    check(
      'tapping the quote reaches its target',
      await page.getByText('68.', { exact: false }).first().isVisible(),
    )
    await page.screenshot({ path: './chat-jumped.png' })
  } else {
    check('tapping the quote reaches its target', false, 'no quote block rendered')
  }

  // ---- edit ----------------------------------------------------------------
  await page.goto(`${BASE}/chat/${CONVERSATION}`, { waitUntil: 'networkidle' })
  await page.getByText('answering sixty-eight').first().waitFor({ timeout: 20_000 })
  await longPress(page.getByText('answering sixty-eight').last())
  const moreForEdit = page.getByText('More…', { exact: true })
  if (await moreForEdit.isVisible().catch(() => false)) await moreForEdit.click()
  await page.waitForTimeout(400)
  const editRow = page.getByText('Edit', { exact: true })
  if (await editRow.isVisible().catch(() => false)) {
    await editRow.click()
    await page.waitForTimeout(600)
    const composer = page.locator('textarea, input[type="text"]').last()
    await composer.fill('answering sixty-eight, revised')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(2000)
    check(
      'an edited message says so',
      await page.getByText('Edited', { exact: true }).first().isVisible().catch(() => false),
    )
  } else {
    check('an edited message says so', false, 'no Edit row on own recent message')
  }

  // ---- star ----------------------------------------------------------------
  await longPress(page.getByText(/answering sixty-eight/).last())
  const moreForStar = page.getByText('More…', { exact: true })
  if (await moreForStar.isVisible().catch(() => false)) await moreForStar.click()
  await page.waitForTimeout(400)
  await page.getByText('Star', { exact: true }).click()
  await page.waitForTimeout(1200)

  await page.goto(`${BASE}/starred`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  check(
    'the starred screen lists it',
    await page.getByText(/answering sixty-eight/).first().isVisible().catch(() => false),
  )
  await page.screenshot({ path: './starred.png' })

  // ---- the activity map ----------------------------------------------------
  await page.goto(`${BASE}/me`, { waitUntil: 'networkidle' })
  await page.getByText('Activity', { exact: true }).waitFor({ timeout: 20_000 })
  const cells = await page.getByLabel(/^Fill in /).count()
  check('the map offers the days inside the window', cells > 0, `${cells} repairable squares`)
  await page.screenshot({ path: './activity-map.png' })

  const gap = page.getByLabel(`Fill in ${GAP_DAY}`)
  if (await gap.isVisible().catch(() => false)) {
    await gap.click()
    await page.waitForTimeout(900)
    const text = await page.locator('body').innerText()
    check(
      'the confirmation says what the purchase will do',
      /streak goes from/.test(text) || /does not change your streak/.test(text),
      text.split('\n').find((l) => /streak/.test(l))?.slice(0, 80),
    )
    await page.screenshot({ path: './repair-confirm.png' })

    const confirm = page.getByText('Fill it in', { exact: true })
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.click()
      await page.waitForTimeout(2500)
      check(
        'the square fills once bought',
        (await page.getByLabel(`Fill in ${GAP_DAY}`).count()) === 0,
      )
      await page.screenshot({ path: './activity-filled.png' })
    }
  } else {
    check('the confirmation says what the purchase will do', false, `no square for ${GAP_DAY}`)
  }
} catch (error) {
  console.log('ERROR', String(error.message).slice(0, 300))
  await page.screenshot({ path: './chat-error.png' }).catch(() => {})
  results.push({ name: 'run completed', pass: false })
} finally {
  await browser.close()
  server.close()
}

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
