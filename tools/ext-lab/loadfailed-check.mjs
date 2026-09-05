import { chromium } from 'playwright'

const WEB = 'http://localhost:8083'
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 480, height: 900 } })
const page = await ctx.newPage()

await page.goto(WEB, { waitUntil: 'load', timeout: 180000 })
await page.waitForTimeout(12000)
const skip = page.getByText('Skip', { exact: true }).first()
if (await skip.isVisible().catch(() => false)) await skip.click()
await page.waitForTimeout(3000)
await page.getByText('Look around first', { exact: false }).first().click()
await page.waitForTimeout(6000)
console.log('guest at        :', page.url())

// From here on the profile request never lands — the shape that used to leave
// these screens on a spinner forever.
await page.route('**/profiles/me', (route) => route.abort())

await page.goto(`${WEB}/share-profile`, { waitUntil: 'load', timeout: 180000 })
await page.waitForTimeout(16000)
console.log('share-profile   :', page.url())
console.log('  failed notice :', await page.getByText('Could not load this', { exact: false }).first().isVisible().catch(() => false))
console.log('  try again     :', await page.getByText('Try again', { exact: true }).first().isVisible().catch(() => false))
await page.screenshot({ path: './shots/loadfailed.png' })

await browser.close()
