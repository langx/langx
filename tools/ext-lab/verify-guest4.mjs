import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 420, height: 900 } })).newPage()
const errs = []
p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)) })
const step = async (n) => { await p.waitForTimeout(2200); await p.screenshot({ path: `/tmp/g-${n}.png` })
  console.log(n, '|', p.url(), '::', (await p.locator('body').innerText()).replace(/\n+/g, ' / ').slice(0, 320)) }
const click = async (t) => { const l = p.getByText(t, { exact: true }); if (await l.count()) { await l.first().click(); return true } return false }

await p.goto('https://app.langx.io/welcome', { waitUntil: 'networkidle' })
await p.waitForTimeout(2500)
await click('Look around first'); await p.waitForTimeout(1800)
await click('English'); await p.waitForTimeout(600)
await click('Continue'); await p.waitForTimeout(1200)
await click('Turkish'); await p.waitForTimeout(600)
await click('Continue'); await p.waitForTimeout(2000)
// the four level pills sit under the "Turkish" heading
const box = await p.getByText('Choose a level').boundingBox()
await p.mouse.click(62, box.y - 25)   // second pill row, first pill
await p.waitForTimeout(900)
await step('5-level-picked')
await click('Look around first'); await step('6-discover')
console.log('ERRS:', errs.slice(0, 4).join(' ~~ ') || 'none')
await b.close()
