import { chromium } from 'playwright'
const browser = await chromium.launch({ args: ['--no-sandbox'] })
for (const locale of ['tr-TR', 'ar-EG']) {
  const ctx = await browser.newContext({ locale })
  const page = await ctx.newPage()
  const errors = [], failed = []
  page.on('pageerror', e => errors.push(String(e).slice(0, 120)))
  page.on('requestfailed', r => failed.push(r.url().slice(0, 80)))
  await page.goto('https://app.langx.io/sign-in', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForFunction(() => document.body.innerText.trim().length > 20, null, { timeout: 90000 })
  await page.waitForTimeout(2000)
  const text = (await page.innerText('body')).replace(/\s+/g, ' ').slice(0, 90)
  const dir = await page.evaluate(() => document.documentElement.dir || 'ltr')
  console.log(`${locale}: dir=${dir} | ${text}`)
  if (errors.length) console.log('   page errors:', errors[0])
  if (failed.length) console.log('   failed requests:', failed.slice(0, 2).join(', '))
  await page.screenshot({ path: `/tmp/i18n/app2-${locale}.png` })
  await ctx.close()
}
await browser.close()
