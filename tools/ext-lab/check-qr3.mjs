import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)) })
await page.goto('https://app.langx.io/qr', { waitUntil: 'networkidle', timeout: 45000 })
await page.waitForTimeout(7000)
const html = await page.content()
const i = html.indexOf('S8') // any code
const codeEl = await page.locator('text=/^[A-Z0-9]{6,10}$/').count()
console.log('code elements:', codeEl)
// dump the element that holds the code, plus its siblings
const card = await page.evaluate(() => {
  const els = [...document.querySelectorAll('div')]
  const withCode = els.find((e) => /^[A-Z0-9]{6,10}$/.test(e.textContent?.trim() ?? ''))
  return withCode?.parentElement?.outerHTML?.slice(0, 900) ?? 'not found'
})
console.log('CARD:', card)
console.log('ERRORS:', errs.slice(0, 3).join(' | ') || 'none')
await browser.close()
