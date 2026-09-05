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

// Black-hole the websocket: routes are matched before the network, so the
// frame is "sent" and the ack never comes — the case DevTools offline cannot
// reproduce because it closes the socket cleanly.
await page.route('**/socket.io/**', () => {})
console.log('websocket black-holed')

const box = page.locator('textarea').last()
await box.fill('bu mesaj gitmeyecek')
await box.press('Enter')
console.log('waiting out the ack timeout...')
await page.waitForTimeout(17000)

const body = await page.locator('body').innerText()
console.log('unsent row shown :', /Not sent/i.test(body))
console.log('text preserved   :', /bu mesaj gitmeyecek/.test(body))
console.log('composer empty   :', JSON.stringify(await box.inputValue()))
await page.screenshot({ path: './shots/chat-unsent.png' })
await browser.close()
