import { chromium } from 'playwright'

const ME = process.env.COOKIE
const ANNA = process.env.ANNA
const CHAT = process.env.CHAT
const browser = await chromium.launch({ args: ['--no-sandbox'] })

async function open(cookie, path) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } })
  const [name, value] = cookie.split('=')
  await ctx.addCookies([{ name, value, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }])
  const page = await ctx.newPage()
  await page.goto(`http://localhost:8082${path}`, { waitUntil: 'domcontentloaded', timeout: 180000 })
  await page.waitForTimeout(22000)
  return page
}

function badgeOf(page) {
  return page.evaluate(() => {
    // The tab bar badge is a small text node inside the Chats tab button.
    const tabs = [...document.querySelectorAll('[role="tab"], [role="button"]')]
    const chats = tabs.find((el) => (el.innerText || '').includes('Chats'))
    if (!chats) return { found: false }
    const text = (chats.innerText || '').replace('Chats', '').trim()
    return { found: true, badge: text }
  })
}

// The reader sits on Discover, a tab that never loads the chat list.
const me = await open(ME, '/discover')
console.log('BEFORE', JSON.stringify(await badgeOf(me)))
await me.screenshot({ path: './shots/unread-0-before.png' })

// The other side sends a message through the app, over the socket.
const anna = await open(ANNA, `/chat/${CHAT}`)
const composer = anna.getByPlaceholder(/message|Message/i).first()
await composer.fill('Badge test message')
await anna.keyboard.press('Enter')
await anna.waitForTimeout(2500)
await composer.fill('And a second one')
await anna.keyboard.press('Enter')
await anna.waitForTimeout(4000)
await anna.screenshot({ path: './shots/unread-1-sent.png' })

await me.waitForTimeout(4000)
console.log('AFTER-SEND', JSON.stringify(await badgeOf(me)))
await me.screenshot({ path: './shots/unread-2-badge.png' })

// Reading the thread clears it.
await me.goto(`http://localhost:8082/chat/${CHAT}`, { waitUntil: 'domcontentloaded' })
await me.waitForTimeout(6000)
await me.goto('http://localhost:8082/discover', { waitUntil: 'domcontentloaded' })
await me.waitForTimeout(6000)
console.log('AFTER-READ', JSON.stringify(await badgeOf(me)))
await me.screenshot({ path: './shots/unread-3-cleared.png' })
await browser.close()
