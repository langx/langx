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
await page.getByText(/Look around first/i).first().click()
await page.waitForTimeout(11000)

async function choose(label) {
  const box = page.locator('input, textarea').last()
  await box.fill(label)
  await page.waitForTimeout(1800)
  await page.getByText(new RegExp(`^${label}$`)).first().click()
  await page.waitForTimeout(1200)
}
await choose('Russian')
await page.getByText(/^Continue$/).first().click()
await page.waitForTimeout(2500)
await choose('Turkish')
await page.getByText(/^Continue$/).first().click()
await page.waitForTimeout(3500)
const bars = page.locator('[role="button"]')
const n = await bars.count()
for (let i = 0; i < n; i++) {
  const label = await bars.nth(i).getAttribute('aria-label')
  if (label && /—/.test(label)) { await bars.nth(i).click(); break }
}
await page.waitForTimeout(1500)
await page.getByText(/Look around first/i).first().click()
await page.waitForTimeout(12000)
console.log('discover:', page.url())
const body = await page.locator('body').innerText()
console.log('sees people:', /Elif|@test_/.test(body))
await page.screenshot({ path: './shots/guest-4-discover.png' })

// A guest tapping a write action must land on sign-up.
await page.goto(`${B}/feed`, { waitUntil: 'load', timeout: 120000 })
await page.waitForTimeout(8000)
const ask = page.getByText(/\+ Ask/).first()
if (await ask.count()) {
  await ask.click()
  await page.waitForTimeout(2000)
  const box = page.locator('input, textarea').last()
  await box.fill('bir cumle')
  await page.waitForTimeout(800)
  const post = page.getByText(/^Post$/).first()
  console.log('post button present:', await post.count())
  if (await post.count()) { await post.click(); await page.waitForTimeout(7000) }
}
console.log('after trying to post:', page.url())
await page.screenshot({ path: './shots/guest-5-gate.png' })
await browser.close()
