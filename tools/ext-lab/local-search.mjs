import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 420, height: 900 } })).newPage()
const errs = []
p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 130)) })
const shot = async (n) => { await p.waitForTimeout(1800); await p.screenshot({ path: `/tmp/L-${n}.png` })
  console.log(n, '|', p.url(), '::', (await p.locator('body').innerText()).replace(/\n+/g, ' / ').slice(0, 200)) }
const click = async (t) => { const l = p.getByText(t, { exact: true }); if (await l.count()) { await l.first().click(); return true } return false }

await p.goto('http://localhost:8081/', { waitUntil: 'networkidle' })
await p.waitForTimeout(9000)
console.log('start', p.url(), (await p.locator('body').innerText()).replace(/\n+/g,' / ').slice(0,160))
await click('Skip'); await p.waitForTimeout(2500)
await click('Look around first'); await p.waitForTimeout(2500)
await click('English'); await p.waitForTimeout(700); await click('Continue'); await p.waitForTimeout(1500)
await click('Turkish'); await p.waitForTimeout(700); await click('Continue'); await p.waitForTimeout(2500)
const box = await p.getByText('Choose a level').boundingBox()
if (box) { await p.mouse.click(62, box.y - 25); await p.waitForTimeout(900) }
await click('Look around first'); await p.waitForTimeout(3000)
await shot('1-discover')
await p.getByLabel(/search by username/i).first().click()
await shot('2-search-open')
await p.locator('input').first().fill('test')
await shot('3-typed')
console.log('ERRS:', errs.slice(0,3).join(' ~~ ') || 'none')
await b.close()
