import { chromium } from 'playwright'
const [path, out, scrollY = '1200'] = process.argv.slice(2)
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const context = await browser.newContext({ viewport: { width: 400, height: 860 }, hasTouch: true, deviceScaleFactor: 2 })
const r = await context.request.post('http://localhost:4000/api/auth/sign-in/email', {
  headers: { origin: 'http://localhost:8081' },
  data: { email: process.env.SEED_EMAIL ?? 'd7_ada@test.langx.invalid', password: process.env.SEED_PASSWORD ?? 'seedseed1' },
})
if (!r.ok()) throw new Error('sign-in ' + r.status())
const page = await context.newPage()
await page.goto(`http://localhost:8081${path}`, { waitUntil: 'load', timeout: 240000 })
await page.waitForTimeout(8000)
await page.evaluate((y) => {
  const nodes = [...document.querySelectorAll('div')]
  const scroller = nodes.filter((n) => n.scrollHeight > n.clientHeight + 50).sort((a, b) => b.scrollHeight - a.scrollHeight)[0]
  if (scroller) scroller.scrollTop = Number(y)
}, scrollY)
await page.waitForTimeout(1200)
await page.screenshot({ path: out })
console.log('shot:', out)
await browser.close()
