import { chromium } from 'playwright'
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 420, height: 900 } })
const p = await ctx.newPage()
const errs = []
p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)) })
const shot = async (n) => { await p.waitForTimeout(1200); await p.screenshot({ path: `/tmp/a2-${n}.png` }) }
const txt = async () => (await p.locator('body').innerText()).replace(/\n+/g, ' | ').slice(0, 300)

await p.goto('https://app.langx.io/', { waitUntil: 'networkidle' })
await p.waitForTimeout(2500)
await shot('1-intro')
console.log('1', p.url(), '::', await txt())

// Skip the carousel to reach the welcome screen
const skip = p.getByText('Skip', { exact: true })
if (await skip.count()) { await skip.first().click(); await p.waitForTimeout(2000) }
await shot('2-welcome')
console.log('2', p.url(), '::', await txt())
console.log('ERRS:', errs.slice(0, 4).join(' ~~ ') || 'none')
await b.close()
