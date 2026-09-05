import { chromium } from 'playwright'
const [name, value] = process.env.COOKIE.split('=')
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } })
await ctx.addCookies([{ name, value, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }])
const page = await ctx.newPage()
const blocked = []
page.on('requestfailed', (r) => { if (r.url().includes('/public/avatar/')) blocked.push(r.url() + ' ' + (r.failure()?.errorText ?? '')) })

await page.goto('http://localhost:8082/chats', { waitUntil: 'domcontentloaded', timeout: 240000 })
await page.waitForTimeout(25000)
const imgs = await page.evaluate(() =>
  [...document.querySelectorAll('img')]
    .map((i) => ({ src: i.currentSrc || i.src, w: Math.round(i.getBoundingClientRect().width) }))
    .filter((i) => i.src.includes('/public/avatar/')),
)
console.log('CHATS-AVATARS', JSON.stringify(imgs))
console.log('BLOCKED', JSON.stringify(blocked))
await page.screenshot({ path: './shots/avatars-1-chats.png' })

await page.goto('http://localhost:8082/me', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(8000)
await page.screenshot({ path: './shots/avatars-2-me.png' })
await browser.close()
