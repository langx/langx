import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage()
const requests = []
page.on('response', (r) => { if (r.url().includes('/public/qr/')) requests.push(`${r.status()} ${r.url()}`) })
await page.goto('https://app.langx.io/qr', { waitUntil: 'networkidle', timeout: 45000 })
await page.waitForTimeout(6000)
console.log('QR requests:', requests.length ? requests.join(' | ') : 'NONE')
const html = await page.content()
console.log('has qr url in dom:', html.includes('/public/qr/link/'))
console.log('svg/img/div-bg:', await page.locator('svg').count(), await page.locator('img').count(),
  html.split('background-image').length - 1)
await browser.close()
