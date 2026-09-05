import { chromium } from 'playwright'
const WEB = 'http://localhost:8083'
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 480, height: 900 } })
const page = await ctx.newPage()

async function pick(name) {
  await page.locator('input').first().fill(name)
  await page.waitForTimeout(1200)
  await page.getByText(name, { exact: true }).first().click()
  await page.waitForTimeout(800)
}

await page.goto(WEB, { waitUntil: 'load', timeout: 180000 })
await page.waitForTimeout(12000)
const skip = page.getByText('Skip', { exact: true }).first()
if (await skip.isVisible().catch(() => false)) await skip.click()
await page.waitForTimeout(3000)
await page.getByText('Look around first', { exact: false }).first().click()
await page.waitForTimeout(6000)
await pick('Turkish')
await page.getByText('Continue', { exact: true }).first().click()
await page.waitForTimeout(1500)
await pick('English')
await page.getByText('Continue', { exact: true }).first().click()
await page.waitForTimeout(2500)
await page.getByRole('button', { name: /English/ }).first().click()
await page.waitForTimeout(1000)
await page.getByText('Look around first', { exact: false }).first().click()
await page.waitForTimeout(8000)
console.log('browsing at :', page.url())

await page.goto(`${WEB}/share-profile`, { waitUntil: 'load', timeout: 180000 })
await page.waitForTimeout(16000)
console.log('deep link   :', page.url())
await page.screenshot({ path: './shots/deeplink.png' })
await browser.close()
