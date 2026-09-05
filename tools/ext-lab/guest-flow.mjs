import { chromium } from 'playwright'
const B = 'http://localhost:8081'
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 800, height: 900 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()

await page.goto(B, { waitUntil: 'load', timeout: 180000 })
await page.waitForTimeout(8000)
for (let i = 0; i < 4 && page.url().includes('/intro'); i++) {
  const s = page.getByText(/^Skip$/).first()
  if (await s.count()) { await s.click(); await page.waitForTimeout(2500) } else break
}
console.log('1. landed on   :', page.url())
await page.screenshot({ path: './shots/guest-1-welcome.png' })

await page.getByText(/Look around first/i).first().click()
await page.waitForTimeout(10000)
console.log('2. after guest :', page.url())
await page.screenshot({ path: './shots/guest-2-languages.png' })

const body = await page.locator('body').innerText()
console.log('   step counter:', (body.match(/Step \d of \d/) || ['none'])[0])
await browser.close()
