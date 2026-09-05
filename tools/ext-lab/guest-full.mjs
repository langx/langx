import { chromium } from 'playwright'
const B = 'http://localhost:8081'
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 800, height: 950 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()

await page.goto(B, { waitUntil: 'load', timeout: 180000 })
await page.waitForTimeout(8000)
for (let i = 0; i < 4 && page.url().includes('/intro'); i++) {
  const s = page.getByText(/^Skip$/).first()
  if (await s.count()) { await s.click(); await page.waitForTimeout(2500) } else break
}
await page.screenshot({ path: './shots/guest-1-welcome.png' })
await page.getByText(/Look around first/i).first().click()
await page.waitForTimeout(11000)
await page.screenshot({ path: './shots/guest-2-languages.png' })

async function choose(label) {
  const box = page.locator('input, textarea').last()
  await box.fill(label)
  await page.waitForTimeout(1800)
  await page.getByText(new RegExp(`^${label}$`)).first().click()
  await page.waitForTimeout(1200)
}
await choose('Turkish')
await page.getByText(/^Continue$/).first().click()
await page.waitForTimeout(2500)
await choose('English')
await page.getByText(/^Continue$/).first().click()
await page.waitForTimeout(3500)
console.log('3. levels        :', page.url(), '|', (await page.locator('body').innerText()).match(/Step \d of \d/)?.[0])
await page.screenshot({ path: './shots/guest-3-levels.png' })

// Pick a level, then the guest submit.
const bars = page.locator('[role="button"]')
const n = await bars.count()
for (let i = 0; i < n; i++) {
  const label = await bars.nth(i).getAttribute('aria-label')
  if (label && /—/.test(label)) { await bars.nth(i).click(); break }
}
await page.waitForTimeout(1500)
await page.getByText(/Look around first/i).first().click()
await page.waitForTimeout(12000)
console.log('4. after submit  :', page.url())
await page.screenshot({ path: './shots/guest-4-discover.png' })
const body = await page.locator('body').innerText()
console.log('   discover shows people:', /@test_/.test(body) || /Anna|Elif|Dmitri/.test(body))
await browser.close()
