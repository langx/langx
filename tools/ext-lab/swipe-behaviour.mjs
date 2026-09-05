import { chromium, devices } from 'playwright'
const B = 'http://localhost:8081'

async function signIn(page) {
  await page.goto(B, { waitUntil: 'load', timeout: 180000 })
  await page.waitForTimeout(6000)
  for (let i = 0; i < 4 && page.url().includes('/intro'); i++) {
    const s = page.getByText(/^Skip$/).first()
    if (await s.count()) { await s.click(); await page.waitForTimeout(2500) } else break
  }
  const email = page.locator('input[type="email"], input[inputmode="email"]').first()
  if (await email.count()) {
    await email.fill('test_elif@test.langx.invalid')
    await page.locator('input[type="password"]').first().fill((process.env.TEST_PASSWORD ?? 'TestUser!2026'))
    await page.getByText(/^Sign in$/).last().click()
    await page.waitForTimeout(12000)
  }
}

async function pinLabel(page) {
  // The long-press menu is the desktop path and reports the current state.
  const row = page.getByText(/Anna/).first()
  await row.click({ button: 'left', delay: 900 })
  await page.waitForTimeout(2500)
  const body = await page.locator('body').innerText()
  const label = /Unpin/i.test(body) ? 'pinned' : /(^|\n)Pin(\n|$)/i.test(body) ? 'unpinned' : '?'
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(1200)
  return label
}

async function run(label, opts) {
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const ctx = await browser.newContext(opts)
  const page = await ctx.newPage()
  await signIn(page)
  await page.goto(`${B}/chats`, { waitUntil: 'load', timeout: 120000 })
  await page.waitForTimeout(9000)
  console.log(`${label}: maxTouchPoints=${await page.evaluate(() => navigator.maxTouchPoints)}`)

  const before = await pinLabel(page)
  const box = await page.getByText(/Anna/).first().boundingBox()
  const y = box.y + box.height / 2
  const startX = box.x + 30
  if (opts.hasTouch) {
    // react-native-web's responder system listens for touch events in a
    // touch-capable context; page.mouse only produces mouse events.
    await page.evaluate(
      async ({ x, y }) => {
        const target = document.elementFromPoint(x, y)
        if (!target) return
        const touch = (cx) =>
          new Touch({ identifier: 1, target, clientX: cx, clientY: y, radiusX: 1, radiusY: 1, force: 1 })
        const fire = (type, cx) =>
          target.dispatchEvent(
            new TouchEvent(type, {
              bubbles: true,
              cancelable: true,
              touches: type === 'touchend' ? [] : [touch(cx)],
              targetTouches: type === 'touchend' ? [] : [touch(cx)],
              changedTouches: [touch(cx)],
            }),
          )
        fire('touchstart', x)
        for (const dx of [20, 50, 80, 110, 130]) {
          fire('touchmove', x + dx)
          await new Promise((r) => setTimeout(r, 40))
        }
        fire('touchend', x + 130)
      },
      { x: startX, y },
    )
  } else {
    await page.mouse.move(startX, y)
    await page.mouse.down()
    for (const dx of [20, 50, 80, 110, 130]) await page.mouse.move(startX + dx, y, { steps: 3 })
    await page.mouse.up()
  }
  await page.waitForTimeout(5000)
  const after = await pinLabel(page)
  console.log(`${label}: pin state ${before} -> ${after}  (changed=${before !== after})`)
  await page.screenshot({ path: `./shots/swipe-${label}.png` })
  await browser.close()
}

await run('touch', { ...devices['Pixel 7'], hasTouch: true })
await run('mouse', { viewport: { width: 900, height: 800 }, hasTouch: false })
