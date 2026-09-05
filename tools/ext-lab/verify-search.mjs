import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 420, height: 900 } })).newPage()
const step = async (n) => { await p.waitForTimeout(1800); await p.screenshot({ path: `/tmp/s-${n}.png` })
  console.log(n, '|', p.url(), '::', (await p.locator('body').innerText()).replace(/\n+/g, ' / ').slice(0, 200)) }
const click = async (t) => { const l = p.getByText(t, { exact: true }); if (await l.count()) { await l.first().click(); return true } return false }

await p.goto('https://app.langx.io/welcome', { waitUntil: 'networkidle' }); await p.waitForTimeout(2500)
await click('Look around first'); await p.waitForTimeout(1800)
await click('English'); await p.waitForTimeout(600); await click('Continue'); await p.waitForTimeout(1200)
await click('Turkish'); await p.waitForTimeout(600); await click('Continue'); await p.waitForTimeout(2000)
const box = await p.getByText('Choose a level').boundingBox()
await p.mouse.click(62, box.y - 25); await p.waitForTimeout(900)
await click('Look around first'); await p.waitForTimeout(2500)

// open search from the header magnifier
await p.getByLabel(/search by username/i).first().click().catch(async () => { await p.mouse.click(357, 35) })
await step('1-search-open')
const field = p.locator('input').first()
await field.fill('al'); await step('2-typed')
console.log('LABELS:', (await p.locator('[aria-label]').evaluateAll(ns => ns.map(n => n.getAttribute('aria-label')).filter(Boolean))).join(' | ').slice(0, 300))
await b.close()
