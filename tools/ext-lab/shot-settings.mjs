import { chromium } from 'playwright'
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
await page.goto('http://localhost:8081', { waitUntil: 'load', timeout: 180000 })
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
await page.goto('http://localhost:8081/settings', { waitUntil: 'load', timeout: 120000 })
await page.waitForTimeout(6000)
const row = page.getByText(/Hide when/i).first()
if (await row.count()) { await row.scrollIntoViewIfNeeded(); await page.waitForTimeout(1200) }
await page.screenshot({ path: './shots/05-settings-privacy.png' })
console.log('done', page.url())
await browser.close()
