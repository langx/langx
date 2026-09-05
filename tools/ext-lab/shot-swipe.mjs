import { chromium, devices } from 'playwright'
const B = 'http://localhost:8081'

async function run(label, contextOptions) {
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const ctx = await browser.newContext(contextOptions)
  const page = await ctx.newPage()
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
  await page.goto(`${B}/chats`, { waitUntil: 'load', timeout: 120000 })
  await page.waitForTimeout(9000)
  // The action labels only exist behind a row when the gesture is offered.
  const body = await page.locator('body').innerText()
  console.log(`${label}: swipe affordance rendered =`, /Archive|Pin/i.test(body))
  await page.screenshot({ path: `./shots/swipe-${label}.png` })
  await browser.close()
}

await run('touch', { ...devices['Pixel 7'], hasTouch: true })
await run('mouse', { viewport: { width: 900, height: 800 }, hasTouch: false })
