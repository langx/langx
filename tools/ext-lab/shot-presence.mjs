import { chromium } from 'playwright'
const B = 'http://localhost:8081'
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 900, height: 1000 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
page.on('console', m => m.type()==='error' && console.log('  err:', m.text().slice(0,140)))
page.on('pageerror', e => console.log('  pageerror:', String(e).slice(0,140)))
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
  await page.waitForTimeout(10000)
}
for (const h of ['test_anna', 'test_dmitri', 'test_katya', 'test_pavel', 'test_olga', 'test_mateo']) {
  await page.goto(`${B}/profile/${h}`, { waitUntil: 'load', timeout: 120000 })
  await page.waitForTimeout(15000)
  const body = await page.locator('body').innerText()
  const line = body.split('\n').find((l) => /Online|Last seen/i.test(l))
  console.log(h.padEnd(14), '->', line ?? '(none)')
  await page.screenshot({ path: `./shots/presence-${h}.png` })
}
await browser.close()
