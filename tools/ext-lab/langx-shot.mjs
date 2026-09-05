import { chromium } from 'playwright'

const BASE = 'http://localhost:8081'
const EMAIL = 'test_elif@test.langx.invalid'
const PASSWORD = process.env.TEST_PASSWORD ?? 'TestUser!2026'

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()

async function shot(name) {
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `./shots/${name}.png` })
  console.log(`  shot ${name} | ${page.url()}`)
}

await page.goto(BASE, { waitUntil: 'load', timeout: 180000 })
await page.waitForTimeout(6000)

// Past the intro carousel.
for (let i = 0; i < 4 && page.url().includes('/intro'); i++) {
  const skip = page.getByText(/^Skip$/).first()
  if (await skip.count()) { await skip.click(); await page.waitForTimeout(2500) }
  else break
}
console.log('after intro:', page.url())

// Sign in.
const email = page.locator('input[type="email"], input[inputmode="email"]').first()
await email.waitFor({ timeout: 20000 })
await email.fill(EMAIL)
await page.locator('input[type="password"]').first().fill(PASSWORD)
await shot('00-signin')
await page.getByText(/^Sign in$/).last().click()
await page.waitForTimeout(10000)
console.log('after signin:', page.url())

for (const [path, name] of [['/me', '01-me'], ['/discover', '02-discover'], ['/settings', '03-settings']]) {
  await page.goto(BASE + path, { waitUntil: 'load', timeout: 120000 })
  await page.waitForTimeout(6000)
  await shot(name)
}

// The activity map, in full, which is what changed.
await page.goto(BASE + '/me', { waitUntil: 'load', timeout: 120000 })
await page.waitForTimeout(6000)
const activity = page.getByText(/^Activity$/).first()
if (await activity.count()) {
  await activity.scrollIntoViewIfNeeded()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: './shots/04-activity-map.png' })
  console.log('  shot 04-activity-map')
}
await browser.close()
