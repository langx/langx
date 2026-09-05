import { chromium } from 'playwright'
const B = 'http://localhost:8081'
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 800, height: 900 }, deviceScaleFactor: 2 })
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
await page.goto(`${B}/chat/6a95378f30979da498e83b83`, { waitUntil: 'load', timeout: 120000 })
await page.waitForTimeout(10000)
const tipText = /Hold any message to correct it/
console.log('tip shown       :', tipText.test(await page.locator('body').innerText()))
await page.screenshot({ path: './shots/tip-shown.png' })

await page.getByRole('button', { name: /Dismiss this tip/i }).click()
await page.waitForTimeout(2000)
console.log('after dismiss   :', tipText.test(await page.locator('body').innerText()))

// It must stay gone across a reload — that is the whole point of persisting it.
await page.reload({ waitUntil: 'load', timeout: 120000 })
await page.waitForTimeout(11000)
console.log('after reload    :', tipText.test(await page.locator('body').innerText()))

// And turning tips back on must bring the dismissed ones back.
await page.goto(`${B}/settings`, { waitUntil: 'load', timeout: 120000 })
await page.waitForTimeout(8000)
const body = await page.locator('body').innerText()
console.log('settings switch :', /Show tips/.test(body))
await page.screenshot({ path: './shots/tips-setting.png' })
await browser.close()
