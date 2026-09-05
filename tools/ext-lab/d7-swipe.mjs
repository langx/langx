import { chromium } from 'playwright'
const conv = process.argv[2]
const touch = process.env.SHOT_TOUCH !== 'false'
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const context = await browser.newContext({
  viewport: { width: 400, height: 860 }, hasTouch: touch, deviceScaleFactor: 2,
})
const r = await context.request.post('http://localhost:4000/api/auth/sign-in/email', {
  headers: { origin: 'http://localhost:8081' },
  data: { email: 'd7_ada@test.langx.invalid', password: process.env.SEED_PASSWORD ?? 'seedseed1' },
})
if (!r.ok()) throw new Error('sign-in ' + r.status())
const page = await context.newPage()
await page.goto(`http://localhost:8081/chat/${conv}`, { waitUntil: 'load', timeout: 240000 })
await page.waitForTimeout(6000)
const target = page.getByText('Bunu sağa kaydırıp yanıtla.')
const box = await target.boundingBox()
if (!box) throw new Error('message not found')
const y = box.y + box.height / 2
const x = box.x + 10
console.log('maxTouchPoints:', await page.evaluate(() => navigator.maxTouchPoints))
if (touch) {
  // CDP rather than dispatched TouchEvents: the responder system reacts to
  // trusted input, and this is the only way to produce it from a test.
  const cdp = await context.newCDPSession(page)
  const send = (type, points) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points })
  await send('touchStart', [{ x, y }])
  for (let d = 10; d <= 100; d += 10) {
    await send('touchMove', [{ x: x + d, y }])
    await page.waitForTimeout(20)
  }
  await send('touchEnd', [])
} else {
  await page.mouse.move(x, y)
  await page.mouse.down()
  for (let d = 8; d <= 90; d += 8) await page.mouse.move(x + d, y, { steps: 2 })
  await page.mouse.up()
}
await page.waitForTimeout(1200)
await page.screenshot({ path: process.argv[3] })
const banner = await page.getByText(/Replying to|Yanıt/).count()
console.log(touch ? 'touch' : 'mouse', '→ reply banner visible:', banner > 0)
await browser.close()
