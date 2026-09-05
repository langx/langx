import { chromium } from 'playwright'

const [pathArg, out = './shots/shot.png', ...rest] = process.argv.slice(2)
const email = process.env.SEED_EMAIL ?? 'd7_ada@test.langx.invalid'
const password = process.env.SEED_PASSWORD ?? 'seedseed1'
const wait = Number(process.env.SHOT_WAIT ?? 4000)

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const context = await browser.newContext({
  viewport: { width: 400, height: 860 },
  hasTouch: process.env.SHOT_TOUCH !== 'false',
  isMobile: false,
  deviceScaleFactor: 2,
  colorScheme: process.env.SHOT_SCHEME === 'dark' ? 'dark' : 'light',
})

if (process.env.SHOT_ANON !== 'true') {
  const signIn = await context.request.post('http://localhost:4000/api/auth/sign-in/email', {
    headers: { origin: 'http://localhost:8081' },
    data: { email, password },
  })
  if (!signIn.ok()) throw new Error(`sign-in failed: ${signIn.status()} ${await signIn.text()}`)
}

const page = await context.newPage()
page.on('console', (m) => {
  if (m.type() === 'error') console.log('console error:', m.text().slice(0, 200))
})
await page.goto(`http://localhost:8081${pathArg}`, { waitUntil: 'load', timeout: 240000 })
await page.waitForTimeout(wait)
await page.screenshot({ path: out, fullPage: false })
console.log('shot:', out, '|', await page.title(), '|', page.url())

for (const extra of rest) {
  const [selector, file] = extra.split('=>')
  if (!file) continue
  await page.click(selector, { timeout: 15000 }).catch((e) => console.log('click failed', e.message))
  await page.waitForTimeout(1500)
  await page.screenshot({ path: file })
  console.log('shot:', file)
}

await browser.close()
