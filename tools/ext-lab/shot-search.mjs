import { chromium } from 'playwright'
const B = 'http://localhost:8081'
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 2 })
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
await page.goto(`${B}/discover`, { waitUntil: 'load', timeout: 120000 })
await page.waitForTimeout(8000)
await page.getByRole('button', { name: /Search by username/i }).click()
await page.waitForTimeout(2500)
await page.screenshot({ path: './shots/search-open-empty.png' })
console.log('back button visible:', await page.getByRole('button', { name: /^Back$/ }).count())
console.log('clear before typing :', await page.getByRole('button', { name: /^Clear$/ }).count())
await page.locator('input').last().fill('test_a')
await page.waitForTimeout(3500)
await page.screenshot({ path: './shots/search-typed.png' })
console.log('clear after typing  :', await page.getByRole('button', { name: /^Clear$/ }).count())
await page.getByRole('button', { name: /^Clear$/ }).click()
await page.waitForTimeout(1500)
console.log('input after clear   :', JSON.stringify(await page.locator('input').last().inputValue()))
await page.getByRole('button', { name: /^Back$/ }).click()
await page.waitForTimeout(2500)
console.log('search closed       :', (await page.getByRole('button', { name: /^Back$/ }).count()) === 0)
await page.screenshot({ path: './shots/search-closed.png' })
await browser.close()
