import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 140)) })
await page.goto('https://app.langx.io/somebodywho', { waitUntil: 'networkidle', timeout: 45000 })
await page.waitForTimeout(3000)
const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 300)
console.log('URL   :', page.url())
console.log('BODY  :', text || '(empty)')
if (errors.length) console.log('ERRORS:', errors.slice(0, 3).join(' | '))
await browser.close()
