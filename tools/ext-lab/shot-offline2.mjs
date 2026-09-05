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

// SIGSTOP, not kill: the socket stays open and the process simply stops
// answering — a frame goes out and no ack ever comes back. A clean close would
// let socket.io reconnect and flush, which is the easy case, not this one.
const pid = execSync("ss -ltnp | grep ':4000' | grep -oP 'pid=\\K[0-9]+' | head -1").toString().trim()
execSync(`kill -STOP ${pid}`)
console.log('api paused, pid', pid)

const box = page.locator('textarea').last()
await box.fill('bu mesaj gitmeyecek')
await box.press('Enter')
console.log('waiting out the ack timeout...')
await page.waitForTimeout(17000)

const body = await page.locator('body').innerText()
console.log('unsent row shown  :', /Not sent/i.test(body))
console.log('text preserved    :', /bu mesaj gitmeyecek/.test(body))
// The wedge: before the fix, `sending` stayed true forever and the composer
// refused a second message.
await box.fill('ikinci mesaj')
await page.waitForTimeout(500)
console.log('composer usable   :', (await box.inputValue()) === 'ikinci mesaj')
await page.screenshot({ path: './shots/chat-unsent.png' })
execSync(`kill -CONT ${pid}`)
console.log('api resumed')
await browser.close()
