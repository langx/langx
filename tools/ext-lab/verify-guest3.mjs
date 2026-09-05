import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 420, height: 900 } })).newPage()
const errs = []
p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)) })
const step = async (n) => { await p.waitForTimeout(1800); await p.screenshot({ path: `/tmp/g-${n}.png` })
  console.log(n, '|', p.url(), '::', (await p.locator('body').innerText()).replace(/\n+/g, ' / ').slice(0, 300)) }
const click = async (t) => { const l = p.getByText(t, { exact: true }); if (await l.count()) { await l.first().click(); return true } return false }

await p.goto('https://app.langx.io/welcome', { waitUntil: 'networkidle' })
await p.waitForTimeout(2500)
await click('Look around first'); await p.waitForTimeout(1800)
await click('English'); await p.waitForTimeout(600)
await click('Continue'); await p.waitForTimeout(1200)
await click('Turkish'); await p.waitForTimeout(600)
await click('Continue'); await p.waitForTimeout(1800)
// levels: pick the first radio/pill
const pills = p.locator('[role="radio"], [role="button"]')
console.log('pill count', await pills.count())
for (let i = 0; i < await pills.count(); i++) {
  const t = (await pills.nth(i).innerText().catch(() => '')).trim()
  if (t && t.length < 40) console.log(' pill', i, JSON.stringify(t))
}
await step('5-levels')
await b.close()
