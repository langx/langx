import { chromium, devices } from 'playwright'
const B = 'http://localhost:8081'
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await browser.newContext({ ...devices['Pixel 7'], hasTouch: true })
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
await page.goto(`${B}/chats`, { waitUntil: 'load', timeout: 120000 })
await page.waitForTimeout(9000)

const box = await page.getByText(/Anna/).first().boundingBox()
const y = Math.round(box.y + box.height / 2)
const x = Math.round(box.x + 30)
const cdp = await page.context().newCDPSession(page)
const send = (type, px) =>
  cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: type === 'touchEnd' ? [] : [{ x: px, y, id: 1 }],
  })

await send('touchStart', x)
for (const dx of [15, 35, 60, 90, 120, 140]) {
  await send('touchMove', x + dx)
  await page.waitForTimeout(45)
}
await send('touchEnd', x + 140)
console.log('swiped right (pin)')
await page.waitForTimeout(6000)
await page.screenshot({ path: './shots/swipe-after.png' })
await browser.close()
