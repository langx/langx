import { chromium } from 'playwright'
const [name, value] = process.env.COOKIE.split('=')
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] })
const ctx = await browser.newContext({ viewport: { width: 390, height: 950 }, permissions: ['microphone'] })
await ctx.addCookies([{ name, value, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }])
const page = await ctx.newPage()
await page.goto('http://localhost:8082/feed', { waitUntil: 'domcontentloaded', timeout: 180000 })
await page.waitForTimeout(20000)
await page.getByText('Ask', { exact: false }).first().click()
await page.waitForTimeout(1500)
await page.getByPlaceholder('The sentence you are unsure about').fill('Recording state check')
await page.getByLabel('Record a voice note').click()
await page.waitForTimeout(4000)
const info = await page.evaluate(() => {
  const el = [...document.querySelectorAll('*')].filter((e) => (e.innerText || '').trim() === 'Post').pop()
  const r = el ? el.getBoundingClientRect() : null
  return { post: r ? { w: Math.round(r.width), h: Math.round(r.height) } : null, text: document.body.innerText.slice(0, 200) }
})
console.log('RECORDING', JSON.stringify(info))
await page.screenshot({ path: './shots/composer-recording.png' })
await browser.close()
