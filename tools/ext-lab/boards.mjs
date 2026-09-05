import { chromium } from 'playwright'
const [name, value] = process.env.COOKIE.split('=')
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } })
await ctx.addCookies([{ name, value, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }])
const page = await ctx.newPage()

async function scrollInfo(label, path, wait = 8000) {
  await page.goto(`http://localhost:8082${path}`, { waitUntil: 'domcontentloaded', timeout: 240000 })
  await page.waitForTimeout(wait)
  const info = await page.evaluate(() => {
    const scroller = [...document.querySelectorAll('div')].find(
      (el) => el.scrollHeight > el.clientHeight + 20 && el.clientHeight > 300,
    )
    return {
      scrollable: !!scroller,
      overflow: scroller ? scroller.scrollHeight - scroller.clientHeight : 0,
      text: document.body.innerText.slice(0, 300),
    }
  })
  console.log(label, JSON.stringify(info))
  return info
}

await scrollInfo('BADGES', '/badges', 25000)
await page.screenshot({ path: './shots/boards-1-badges.png' })
await page.evaluate(() => {
  const s = [...document.querySelectorAll('div')].find((el) => el.scrollHeight > el.clientHeight + 20 && el.clientHeight > 300)
  if (s) s.scrollTop = s.scrollHeight
})
await page.waitForTimeout(1500)
await page.screenshot({ path: './shots/boards-2-badges-bottom.png' })

await scrollInfo('STREAK', '/streak')
await page.evaluate(() => {
  const s = [...document.querySelectorAll('div')].find((el) => el.scrollHeight > el.clientHeight + 20 && el.clientHeight > 300)
  if (s) s.scrollTop = s.scrollHeight
})
await page.waitForTimeout(2000)
console.log('STREAK-BOTTOM', JSON.stringify((await page.evaluate(() => document.body.innerText)).slice(-320)))
await page.screenshot({ path: './shots/boards-3-streak-board.png' })

await scrollInfo('WALLET', '/wallet')
await page.screenshot({ path: './shots/boards-4-wallet.png' })
await browser.close()
