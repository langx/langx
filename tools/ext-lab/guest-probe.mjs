import { chromium } from 'playwright'
const B = 'http://localhost:8081'
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 800, height: 900 } })
const page = await ctx.newPage()
page.on('console', m => { if (m.type() === 'error') console.log('  console:', m.text().slice(0, 200)) })
page.on('pageerror', e => console.log('  pageerror:', String(e).slice(0, 200)))
page.on('response', r => { if (r.url().includes('/api/auth') || r.url().includes('/profiles')) console.log('  net:', r.status(), r.url().replace(B,'').slice(0,60)) })

await page.goto(B, { waitUntil: 'load', timeout: 180000 })
await page.waitForTimeout(8000)
for (let i = 0; i < 4 && page.url().includes('/intro'); i++) {
  const s = page.getByText(/^Skip$/).first()
  if (await s.count()) { await s.click(); await page.waitForTimeout(2500) } else break
}
await page.getByText(/Look around first/i).first().click()
await page.waitForTimeout(12000)
console.log('url:', page.url())
console.log('body head:', (await page.locator('body').innerText()).slice(0, 120).replace(/\n/g, ' | '))
await browser.close()
