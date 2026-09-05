import { chromium } from 'playwright'
const [name, value] = process.env.COOKIE.split('=')
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 390, height: 950 } })
await ctx.addCookies([{ name, value, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }])
const page = await ctx.newPage()
await page.goto('http://localhost:8082/feed', { waitUntil: 'domcontentloaded', timeout: 180000 })
await page.waitForTimeout(20000)
await page.getByText('Ask', { exact: false }).first().click()
await page.waitForTimeout(1200)
const SENTENCE = 'Composer order check sentence'
await page.getByPlaceholder('The sentence you are unsure about').fill(SENTENCE)
await page.getByText('Post', { exact: true }).last().click()
await page.waitForTimeout(1200)
console.log('JUST-AFTER', JSON.stringify((await page.evaluate(() => document.body.innerText.slice(0, 240)))))
await page.screenshot({ path: './shots/order-1-just-posted.png' })
await page.waitForTimeout(4000)
const order = await page.evaluate((s) => {
  const t = document.body.innerText
  const mine = t.indexOf(s)
  const other = t.indexOf('I go to the store yesterday')
  return { minePos: mine, otherPos: other, mineFirst: mine !== -1 && mine < other }
}, SENTENCE)
console.log('ORDER', JSON.stringify(order))
await page.screenshot({ path: './shots/order-2-feed.png' })
await browser.close()
