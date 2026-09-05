import { chromium } from 'playwright'
import { execSync } from 'node:child_process'
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

const MARK = 'gecikmis-' + Date.now().toString(36)
const pid = execSync("ss -ltnp | grep ':4000' | grep -oP 'pid=\\K[0-9]+' | head -1").toString().trim()
execSync(`kill -STOP ${pid}`)
const box = page.locator('textarea').last()
await box.fill(MARK)
await box.press('Enter')
await page.waitForTimeout(17000)
let body = await page.locator('body').innerText()
console.log('while paused  — unsent row:', /Not sent/i.test(body))

execSync(`kill -CONT ${pid}`)
await page.waitForTimeout(15000)
body = await page.locator('body').innerText()
const occurrences = (body.match(new RegExp(MARK, 'g')) || []).length
console.log('after resume  — unsent row:', /Not sent/i.test(body))
console.log('after resume  — copies of the message:', occurrences)
await page.screenshot({ path: './shots/chat-unsent-resolved.png' })
await browser.close()
