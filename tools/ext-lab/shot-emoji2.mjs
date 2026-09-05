import { chromium } from 'playwright'
const B = 'http://localhost:8081'
const CHAT = '6a95378f30979da498e83b83'
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 800, height: 1000 }, deviceScaleFactor: 2 })
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
await page.goto(`${B}/chat/${CHAT}`, { waitUntil: 'load', timeout: 120000 })
await page.waitForTimeout(9000)
for (const text of ['😀', '👨‍👩‍👧‍👦🇹🇷', 'sadece yazı']) {
  const box = page.locator('input, textarea').last()
  await box.click()
  await box.fill(text)
  await page.waitForTimeout(900)
  // The mic turns into a send button once there is text; it is the last button.
  const buttons = page.locator('[role="button"]')
  const n = await buttons.count()
  await buttons.nth(n - 1).click({ timeout: 15000 }).catch(async () => {
    await box.press('Enter')
  })
  await page.waitForTimeout(4000)
}
const body = await page.locator('body').innerText()
console.log('emoji in thread:', /😀/.test(body), /👨‍👩‍👧‍👦/.test(body), /🇹🇷/.test(body))
await page.screenshot({ path: './shots/chat-big-emoji.png' })
await browser.close()
