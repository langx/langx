import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 420, height: 900 } })).newPage()
const errs = []
p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)) })
const step = async (n) => { await p.waitForTimeout(1800); await p.screenshot({ path: `/tmp/g-${n}.png` })
  console.log(n, p.url(), '::', (await p.locator('body').innerText()).replace(/\n+/g, ' | ').slice(0, 260)) }

await p.goto('https://app.langx.io/welcome', { waitUntil: 'networkidle' })
await p.waitForTimeout(2500)
await p.getByText('Look around first').click()
await step('1-languages')

// Native picker
const search = p.getByPlaceholder(/search/i)
if (await search.count()) { await search.first().fill('English'); await p.waitForTimeout(900) }
const en = p.getByText('English', { exact: true })
if (await en.count()) await en.first().click()
await step('2-native-picked')

for (const label of ['Next', 'Continue', 'Done']) {
  const btn = p.getByText(label, { exact: true })
  if (await btn.count() && await btn.first().isVisible()) { await btn.first().click(); break }
}
await step('3-after-next')
console.log('ERRS:', errs.slice(0, 4).join(' ~~ ') || 'none')
await b.close()
