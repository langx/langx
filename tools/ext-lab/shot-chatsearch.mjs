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
for (const [path, name] of [['/chats', 'chats'], ['/discover', 'discover']]) {
  await page.goto(B + path, { waitUntil: 'load', timeout: 120000 })
  await page.waitForTimeout(9000)
  const toggle = page.getByRole('button', { name: /Search by username/i }).first()
  console.log(`${name}: toggle present`, await toggle.count())
  await toggle.click()
  await page.waitForTimeout(2500)
  await page.locator('input, textarea').last().fill('test_a')
  await page.waitForTimeout(4000)
  const body = await page.locator('body').innerText()
  console.log(`${name}: found Anna`, /@test_anna/.test(body))
  await page.screenshot({ path: `./shots/search-${name}.png` })
  await page.getByRole('button', { name: /^Back$/ }).click()
  await page.waitForTimeout(2000)
  console.log(`${name}: closed  `, (await page.getByRole('button', { name: /^Back$/ }).count()) === 0)
}
await browser.close()
