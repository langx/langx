import { chromium } from 'playwright'
const [name, value] = process.env.COOKIE.split('=')
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 420, height: 950 } })
await ctx.addCookies([{ name, value, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }])
const page = await ctx.newPage()
await page.goto('http://localhost:8082/wallet', { waitUntil: 'domcontentloaded', timeout: 240000 })
await page.waitForTimeout(25000)
const text = await page.evaluate(() => document.body.innerText)
console.log('WALLET', JSON.stringify(text.slice(0, 500)))
await page.screenshot({ path: './shots/store-1-wallet.png' })

// The repair row, if the seed left a gap in the window.
// The buy button, by its accessibility label, not the row text.
const repair = page.locator('[aria-label*="Buy a day back"]').first()
if (await repair.count()) {
  await repair.click()
  await page.waitForTimeout(2500)
  console.log('CONFIRM', JSON.stringify((await page.evaluate(() => document.body.innerText)).slice(0, 400)))
  await page.screenshot({ path: './shots/store-2-confirm.png' })

  // Go through with it.
  const yes = page.getByText('Fill it in', { exact: false }).first()
  if (await yes.count()) {
    await yes.click()
    await page.waitForTimeout(4000)
    console.log('AFTER-BUY', JSON.stringify((await page.evaluate(() => document.body.innerText)).slice(0, 400)))
    await page.screenshot({ path: './shots/store-3-bought.png' })
  } else {
    console.log('NO-CONFIRM-BUTTON')
  }
}

// And the freeze at a full bank must now say something rather than nothing.
await browser.close()
