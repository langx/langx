import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 420, height: 900 } })).newPage()
const errs = []
p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 130)) })
const shot = async (n) => { await p.waitForTimeout(2200); await p.screenshot({ path: `/tmp/T-${n}.png`, fullPage: true })
  console.log(n, '|', p.url(), '::', (await p.locator('body').innerText()).replace(/\n+/g, ' / ').slice(0, 260)) }
const click = async (t) => { const l = p.getByText(t, { exact: true }); if (await l.count()) { await l.first().click(); return true } return false }

await p.goto('http://localhost:8081/', { waitUntil: 'networkidle' }); await p.waitForTimeout(9000)
await click('Skip'); await p.waitForTimeout(2000)
await click('I already have an account'); await p.waitForTimeout(2500)
const inputs = p.locator('input')
await inputs.nth(0).fill('test_george@test.langx.invalid')
await inputs.nth(1).fill((process.env.TEST_PASSWORD ?? 'TestUser!2026'))
await click('Sign in'); await p.waitForTimeout(6000)

await click('Me'); await shot('2-me')
await click('Day streak'); await shot('3-streak-history')
await p.goBack(); await p.waitForTimeout(2000)
await click('Corrections'); await shot('4-correction-history')
console.log('ERRS:', errs.slice(0,3).join(' ~~ ') || 'none')
await b.close()
