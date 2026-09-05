import { chromium } from 'playwright'
const B = 'http://localhost:8081'
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 900, height: 1100 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
await page.goto(B, { waitUntil: 'load', timeout: 180000 })
await page.waitForTimeout(6000)
for (let i = 0; i < 4 && page.url().includes('/intro'); i++) {
  const s = page.getByText(/^Skip$/).first()
  if (await s.count()) { await s.click(); await page.waitForTimeout(2500) } else break
}
const email = page.locator('input[type="email"], input[inputmode="email"]').first()
if (await email.count()) {
  await email.fill('test_elif@test.langx.invalid')
  await page.locator('input[type="password"]').first().fill((process.env.TEST_PASSWORD ?? 'TestUser!2026'))
  await page.getByText(/^Sign in$/).last().click()
  await page.waitForTimeout(12000)
}
await page.goto(`${B}/settings`, { waitUntil: 'load', timeout: 120000 })
await page.waitForTimeout(9000)
const body = await page.locator('body').innerText()
console.log('language rows visible:', (body.match(/English|Türkçe|Deutsch|Español/g) || []).length)
console.log('app language row    :', /App language/.test(body))
await page.screenshot({ path: './shots/settings-collapsed.png', fullPage: true })
await page.getByText('App language').click()
await page.waitForTimeout(6000)
console.log('picker url          :', page.url())
console.log('picker has 9 rows   :', (await page.locator('body').innerText()).split('\n').filter(l => /English|Türkçe|Deutsch|Español|Français|Português|Русский|العربية|Device/.test(l)).length)
await page.screenshot({ path: './shots/settings-language-picker.png' })
await browser.close()
