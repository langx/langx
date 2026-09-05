// 5 September 2026: the Fluent → Polyglot upgrade path under the fake store.
// Signs in as a seeded account, buys Fluent monthly, shoots the paywall with
// the upgrade notice, buys Polyglot, and reads the tier back.
import { chromium } from 'playwright'
const B = 'http://localhost:8081'
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('pageerror:', e.message))
await page.goto(B, { waitUntil: 'load', timeout: 180000 })
await page.waitForTimeout(8000)
for (let i = 0; i < 4 && page.url().includes('/intro'); i++) {
  const s = page.getByText(/^Skip$/).first()
  if (await s.count()) { await s.click(); await page.waitForTimeout(2500) } else break
}
const haveAccount = page.getByText(/I already have an account/).first()
if (await haveAccount.count()) { await haveAccount.click(); await page.waitForTimeout(3000) }
const email = page.locator('input[type="email"], input[inputmode="email"]').first()
if (await email.count()) {
  await email.fill(process.env.TEST_EMAIL ?? 'test_anna@test.langx.invalid')
  await page.locator('input[type="password"]').first().fill(process.env.TEST_PASSWORD ?? 'TestUser!2026')
  await page.getByText(/^Sign in$/).last().click()
  await page.waitForTimeout(12000)
}
console.log('after sign-in:', page.url())

async function paywallText() {
  await page.goto(`${B}/paywall`, { waitUntil: 'load', timeout: 120000 })
  await page.waitForTimeout(7000)
  return (await page.locator('body').innerText()).split('\n').filter((l) => /free|Fluent|Polyglot|Included|Upgrading|difference|for life|TEST/.test(l))
}
console.log('paywall (free):', JSON.stringify(await paywallText()))
await page.screenshot({ path: './shots/paywall-free.png', fullPage: true })

await page.getByText(/^Monthly — TEST \$4\.99$/).first().click()
await page.waitForTimeout(6000)
console.log('paywall (after Fluent):', JSON.stringify(await paywallText()))
await page.screenshot({ path: './shots/paywall-fluent.png', fullPage: true })

await page.getByText(/^Monthly — TEST/).nth(1).click()
await page.waitForTimeout(6000)
console.log('paywall (after Polyglot):', JSON.stringify(await paywallText()))
await page.screenshot({ path: './shots/paywall-polyglot.png', fullPage: true })

await page.goto(`${B}/settings`, { waitUntil: 'load', timeout: 120000 })
await page.waitForTimeout(6000)
const settings = (await page.locator('body').innerText()).split('\n').filter((l) => /plan|Plan|Renews|Manage|Fluent|Polyglot/.test(l))
console.log('settings:', JSON.stringify(settings))
await page.screenshot({ path: './shots/settings-plan.png', fullPage: true })
await browser.close()
