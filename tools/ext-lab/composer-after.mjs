import { chromium } from 'playwright'
const [name, value] = process.env.COOKIE.split('=')
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 390, height: 950 } })
await ctx.addCookies([{ name, value, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }])
const page = await ctx.newPage()
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE-ERR', m.text().slice(0, 160)) })
await page.goto('http://localhost:8082/feed', { waitUntil: 'domcontentloaded', timeout: 180000 })
await page.waitForTimeout(20000)

await page.getByText('Ask', { exact: false }).first().click()
await page.waitForTimeout(1500)
const SENTENCE = 'My brand new post from the composer'
await page.getByPlaceholder('The sentence you are unsure about').fill(SENTENCE)

async function state(label) {
  const info = await page.evaluate(() => {
    const post = [...document.querySelectorAll('*')].filter((e) => (e.innerText || '').trim() === 'Post').pop()
    const pr = post ? post.getBoundingClientRect() : null
    const blob = [...document.querySelectorAll('img')].map((i) => ({ src: i.src.slice(0, 5), w: Math.round(i.getBoundingClientRect().width), h: Math.round(i.getBoundingClientRect().height) })).filter((i) => i.src === 'blob:')
    return {
      post: pr ? { w: Math.round(pr.width), h: Math.round(pr.height) } : null,
      camera: !!document.querySelector('[aria-label="Attach a photo"]'),
      remove: !!document.querySelector('[aria-label="Remove attachment"]'),
      thumbs: blob,
    }
  })
  console.log(label, JSON.stringify(info))
}

await state('EMPTY')
const chooser = page.waitForEvent('filechooser', { timeout: 15000 })
await page.getByLabel('Attach a photo').click()
;(await chooser).setFiles('./sample.png')
await page.waitForTimeout(3000)
await state('ATTACHED')
await page.screenshot({ path: './shots/composer-after-attached.png' })

// detach
await page.getByLabel('Remove attachment').click()
await page.waitForTimeout(1500)
await state('DETACHED')
await page.screenshot({ path: './shots/composer-after-detached.png' })

// re-attach and post
const c2 = page.waitForEvent('filechooser', { timeout: 15000 })
await page.getByLabel('Attach a photo').click()
;(await c2).setFiles('./sample.png')
await page.waitForTimeout(2500)
await page.getByText('Post', { exact: true }).last().click()
await page.waitForTimeout(2000)
console.log('TOAST-FRAME', JSON.stringify((await page.evaluate(() => document.body.innerText.slice(0, 160)))))
await page.screenshot({ path: './shots/composer-after-posted.png' })
await page.waitForTimeout(4000)
const order = await page.evaluate((s) => {
  const t = document.body.innerText
  return { firstCardIsNew: t.indexOf(s) !== -1 && t.indexOf(s) < t.indexOf('I go to the store yesterday'), head: t.slice(0, 300) }
}, SENTENCE)
console.log('ORDER', JSON.stringify(order))
await page.screenshot({ path: './shots/composer-after-feed.png' })
await browser.close()
