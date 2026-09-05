import { chromium, devices } from 'playwright'
const B = 'http://localhost:8081'
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await browser.newContext({ ...devices['Pixel 7'], hasTouch: true })
const page = await ctx.newPage()
page.on('pageerror', e => console.log('pageerror:', String(e).slice(0,140)))
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
// Is the row even wrapped? The behind-layer renders both action labels.
const info = await page.evaluate(() => {
  const texts = [...document.querySelectorAll('div[dir="auto"]')].map(e => e.textContent?.trim())
  return {
    hasPinLabel: texts.includes('Pin'),
    hasArchiveLabel: texts.filter(t => t === 'Archive').length,
    maxTouchPoints: navigator.maxTouchPoints,
  }
})
console.log(info)
await page.screenshot({ path: './shots/swipe-probe.png' })
await browser.close()
