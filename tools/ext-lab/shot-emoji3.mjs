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
await page.waitForTimeout(11000)
await page.screenshot({ path: './shots/chat-big-emoji.png' })
// Font size proves the branch: the hero is 48, bubble text is 16.
const sizes = await page.evaluate(() => {
  const out = []
  for (const el of document.querySelectorAll('div[dir="auto"], span')) {
    const text = el.textContent || ''
    if (/^(😀|👨‍👩‍👧‍👦|🇹🇷🎉|sadece yazı, büyümemeli)$/.test(text.trim())) {
      out.push([text.trim(), getComputedStyle(el).fontSize])
    }
  }
  return out
})
console.log(sizes)
await browser.close()
