// 5 September 2026: after the emoji-to-Feather change and the trial-terms
// caption. Signs in as a seeded account, then shoots the screens that changed:
// the intro slides, the profile tiles, the streak screen, the badge grid, the
// leaderboard podium, and the paywall with the fake store's 7-day trial.
import { chromium } from 'playwright'
const B = 'http://localhost:8081'
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('pageerror:', e.message))
await page.goto(B, { waitUntil: 'load', timeout: 180000 })
await page.waitForTimeout(8000)
await page.screenshot({ path: './shots/intro.png' })
for (let i = 0; i < 4 && page.url().includes('/intro'); i++) {
  const s = page.getByText(/^Skip$/).first()
  if (await s.count()) { await s.click(); await page.waitForTimeout(2500) } else break
}
const haveAccount = page.getByText(/I already have an account/).first()
if (await haveAccount.count()) { await haveAccount.click(); await page.waitForTimeout(3000) }
const email = page.locator('input[type="email"], input[inputmode="email"]').first()
if (await email.count()) {
  await email.fill('test_elif@test.langx.invalid')
  await page.locator('input[type="password"]').first().fill(process.env.TEST_PASSWORD ?? 'TestUser!2026')
  await page.getByText(/^Sign in$/).last().click()
  await page.waitForTimeout(12000)
}
console.log('after sign-in:', page.url())
for (const route of ['me', 'streak', 'badges', 'wallet', 'discover', 'paywall']) {
  await page.goto(`${B}/${route}`, { waitUntil: 'load', timeout: 120000 })
  await page.waitForTimeout(7000)
  await page.screenshot({ path: `./shots/${route}.png`, fullPage: true })
  const text = await page.locator('body').innerText()
  console.log(route, '→', page.url(), '|', JSON.stringify(text.replace(/\s+/g, ' ').slice(0, 160)))
  if (route === 'paywall') {
    const trial = text.split('\n').filter((l) => /free/i.test(l))
    console.log('trial lines:', JSON.stringify(trial))
  }
}
await browser.close()
