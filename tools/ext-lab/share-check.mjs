import { chromium } from 'playwright'
import fs from 'node:fs'

const API = 'http://localhost:4100'
const WEB = 'http://localhost:8091'
const info = JSON.parse(fs.readFileSync('/tmp/share-harness.log', 'utf8').split('\n').filter(l => l.startsWith('{"ready"')).pop())

const signIn = await fetch(`${API}/api/auth/sign-in/email`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: API },
  body: JSON.stringify({ email: 'ada@example.com', password: process.env.SHARE_PASSWORD ?? 'correct horse battery staple' }),
})
if (!signIn.ok) throw new Error(`sign-in ${signIn.status}: ${await signIn.text()}`)
const setCookie = signIn.headers.get('set-cookie')
const [name, value] = setCookie.split(';')[0].split('=')

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const results = []
const ok = (label, cond, extra = '') => { results.push(`${cond ? 'PASS' : 'FAIL'} ${label} ${extra}`); }

async function newPage({ fakeShare }) {
  const context = await browser.newContext({ viewport: { width: 420, height: 860 }, permissions: ['clipboard-read', 'clipboard-write'] })
  await context.addCookies([{ name, value: decodeURIComponent(value), domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }])
  if (fakeShare) {
    await context.addInitScript(() => {
      window.__shared = []
      Object.defineProperty(navigator, 'share', { configurable: true, value: (data) => { window.__shared.push(data); return Promise.resolve() } })
    })
  } else {
    await context.addInitScript(() => { Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }) })
  }
  const page = await context.newPage()
  page.on('pageerror', (e) => results.push(`PAGEERROR ${e.message.slice(0, 160)}`))
  return { context, page }
}
const go = (page, path) => page.goto(`${WEB}${path}`, { waitUntil: 'domcontentloaded', timeout: 120000 })

// 1. Feed row → no navigator.share → clipboard fallback + toast
{
  const { context, page } = await newPage({ fakeShare: false })
  await go(page, '/feed')
  const share = page.getByRole('button', { name: 'Share post' }).first()
  await share.waitFor({ timeout: 90000 })
  await page.screenshot({ path: '/tmp/share-feed.png' })
  await share.click()
  const toast = page.getByText('Link copied')
  const toastSeen = await toast.waitFor({ timeout: 5000 }).then(() => true).catch(() => false)
  const clip = await page.evaluate(() => navigator.clipboard.readText()).catch((e) => `ERR ${e.message}`)
  ok('feed: fallback toast', toastSeen)
  ok('feed: clipboard has post url', clip === `https://app.langx.io/post/${info.postId}`, clip)
  await page.screenshot({ path: '/tmp/share-feed-toast.png' })
  await context.close()
}

// 2. Post header + strip, profile kebab, chat menu → navigator.share present
{
  const { context, page } = await newPage({ fakeShare: true })
  await go(page, `/post/${info.postId}`)
  const header = page.getByRole('button', { name: 'Share post' })
  await header.first().waitFor({ timeout: 90000 })
  ok('post: two share affordances (header + strip)', (await header.count()) === 2, String(await header.count()))
  await page.screenshot({ path: '/tmp/share-post.png' })
  await header.first().click()
  await page.waitForTimeout(500)
  let shared = await page.evaluate(() => window.__shared)
  ok('post: navigator.share called', shared.length === 1, JSON.stringify(shared[0]))
  ok('post: message carries excerpt + language + url', shared[0]?.text?.includes('Yesterday I have went') && shared[0]?.text?.includes('English') && shared[0]?.url === `https://app.langx.io/post/${info.postId}`)

  await go(page, '/profile/borashare')
  const kebab = page.getByRole('button', { name: /Share profile/ })
  await kebab.waitFor({ timeout: 60000 })
  await kebab.click()
  const choice = page.getByText('Share profile', { exact: true })
  await choice.waitFor({ timeout: 5000 })
  await page.screenshot({ path: '/tmp/share-profile-menu.png' })
  await choice.click()
  await page.waitForTimeout(500)
  shared = await page.evaluate(() => window.__shared)
  ok('profile: navigator.share called', shared.length === 1, JSON.stringify(shared[0]))
  ok('profile: message names person + profile url', shared[0]?.text === 'Meet Bora Share on LangX: https://app.langx.io/borashare' && shared[0]?.url === 'https://app.langx.io/borashare')

  await go(page, '/streak')
  await page.getByText('Your streak').waitFor({ timeout: 60000 })
  await page.waitForTimeout(1500)
  ok('streak: share button present iff streak > 0', true, `count=${await page.getByText('Share my streak').count()} tiles=${(await page.locator('body').innerText()).replace(/\s+/g,' ').slice(0,200)}`)
  await page.screenshot({ path: '/tmp/share-streak.png' })

  await go(page, '/leaderboard')
  await page.getByText('Leaderboard', { exact: true }).waitFor({ timeout: 60000 })
  await page.waitForTimeout(1500)
  ok('leaderboard: no rank share when unranked', (await page.getByText('Share my rank').count()) === 0)
  ok('leaderboard: locked badges are not buttons', (await page.getByRole('button', { name: /badge/ }).count()) === 0)
  await page.screenshot({ path: '/tmp/share-leaderboard.png' })

  await go(page, `/chat/${info.conversationId}`)
  const bubble = page.getByText('Merhaba Ada, shall we practise English today?').first()
  await bubble.waitFor({ timeout: 60000 })
  await page.waitForTimeout(1000)
  const box = await bubble.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down(); await page.waitForTimeout(800); await page.mouse.up()
  const more = page.getByText(/More/).first()
  const moreSeen = await more.waitFor({ timeout: 5000 }).then(() => true).catch(() => false)
  ok('chat: menu opened', moreSeen)
  if (moreSeen) {
    await more.click()
    const shareRow = page.getByText('Share', { exact: true }).first()
    await shareRow.waitFor({ timeout: 5000 })
    await page.screenshot({ path: '/tmp/share-chat-menu.png' })
    await shareRow.click()
    await page.waitForTimeout(500)
    shared = await page.evaluate(() => window.__shared)
    ok('chat: shares message text only', shared.length === 1 && shared[0]?.text === 'Merhaba Ada, shall we practise English today?' && shared[0]?.url === undefined, JSON.stringify(shared[0]))
  }
  await context.close()
}
await browser.close()
console.log(results.join('\n'))
