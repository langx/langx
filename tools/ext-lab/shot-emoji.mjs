import { chromium } from 'playwright'
const B = 'http://localhost:8081'
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
// Start a conversation from a profile.
await page.goto(`${B}/profile/test_anna`, { waitUntil: 'load', timeout: 120000 })
await page.waitForTimeout(8000)
const composer = page.locator('input, textarea').last()
await composer.fill('Merhaba!')
await page.waitForTimeout(800)
const send = page.getByRole('button', { name: /send/i }).last()
if (await send.count()) { await send.click(); await page.waitForTimeout(9000) }
console.log('after send:', page.url())
if (!page.url().includes('/chat/')) {
  await page.goto(`${B}/chats`, { waitUntil: 'load', timeout: 120000 })
  await page.waitForTimeout(7000)
  const row = page.getByText(/Anna/).first()
  if (await row.count()) { await row.click(); await page.waitForTimeout(8000) }
}
console.log('chat url:', page.url())
for (const text of ['😀', '👨‍👩‍👧‍👦', '🇹🇷', 'sadece yazı']) {
  const box = page.locator('input, textarea').last()
  await box.fill(text)
  await page.waitForTimeout(600)
  await box.press('Enter')
  await page.waitForTimeout(3500)
}
await page.screenshot({ path: './shots/chat-big-emoji.png' })
console.log('done')
await browser.close()
