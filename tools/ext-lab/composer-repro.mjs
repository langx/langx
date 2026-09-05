import { chromium } from 'playwright'

const COOKIE = process.env.COOKIE
const TAG = process.env.TAG || 'before'
const [name, value] = COOKIE.split('=')
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: Number(process.env.VW || 900), height: 950 }, locale: process.env.LOCALE || 'en-US' })
await ctx.addCookies([{ name, value, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }])
const page = await ctx.newPage()

await page.goto('http://localhost:8082/feed', { waitUntil: 'domcontentloaded', timeout: 180000 })
await page.waitForTimeout(20000)

// open the ask composer
await page.getByText(process.env.ASK || 'Ask', { exact: false }).first().click()
await page.waitForTimeout(1500)
await page.getByPlaceholder(process.env.PLACEHOLDER || 'The sentence you are unsure about').fill('This is a test sentence for the composer')
await page.waitForTimeout(500)

async function report(label) {
  const info = await page.evaluate(() => {
    const out = {}
    const btn = [...document.querySelectorAll('*')].filter(
      (el) => (el.innerText || '').trim() === (process.env.POST || 'Post'),
    ).pop()
    const r = btn ? btn.getBoundingClientRect() : null
    out.postButton = r ? { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x) } : null
    const bar = document.querySelector(`[aria-label="${process.env.ATTACH || 'Attach a photo'}"], [aria-label="${process.env.REMOVE || 'Remove attachment'}"]`)
    const br = bar ? bar.closest('div').parentElement.getBoundingClientRect() : null
    out.barRow = br ? { w: Math.round(br.width) } : null
    const cam = document.querySelector(`[aria-label="${process.env.ATTACH || 'Attach a photo'}"]`)
    out.camera = cam ? cam.getBoundingClientRect().toJSON() : null
    const rm = document.querySelector(`[aria-label="${process.env.REMOVE || 'Remove attachment'}"]`)
    out.remove = rm ? rm.getBoundingClientRect().toJSON() : null
    const img = [...document.querySelectorAll('img')].map((i) => ({ src: i.src.slice(0, 24), w: i.getBoundingClientRect().width, h: i.getBoundingClientRect().height }))
    out.blobImages = img.filter((i) => i.src.startsWith('blob:'))
    return out
  })
  console.log(label, JSON.stringify(info))
}

await report('NO-ATTACHMENT')
await page.screenshot({ path: `./shots/composer-${TAG}-1-empty.png` })

// attach a photo: web picker is a hidden file input
const chooser = page.waitForEvent('filechooser', { timeout: 15000 })
await page.getByLabel(process.env.ATTACH || 'Attach a photo').click()
const fc = await chooser
await fc.setFiles('./sample.png')
await page.waitForTimeout(3000)

await report('WITH-ATTACHMENT')
await page.screenshot({ path: `./shots/composer-${TAG}-2-attached.png` })
await browser.close()
