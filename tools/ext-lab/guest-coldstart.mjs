import { chromium } from 'playwright'

const WEB = 'http://localhost:8083'
const API = 'http://localhost:4101'
const counts = () => fetch(`${API}/__guests`).then((r) => r.json())

const browser = await chromium.launch({ args: ['--no-sandbox'] })

async function freshPage() {
  const ctx = await browser.newContext({ viewport: { width: 480, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(WEB, { waitUntil: 'load', timeout: 180000 })
  await page.waitForTimeout(12000)
  // Walk the intro out of the way.
  const skip = page.getByText('Skip', { exact: true }).first()
  if (await skip.isVisible().catch(() => false)) await skip.click()
  await page.waitForTimeout(3000)
  return page
}

const seen = (page, text) =>
  page.getByText(text, { exact: false }).first().isVisible().catch(() => false)

async function pickLanguage(page, name) {
  await page.locator('input').first().fill(name)
  await page.waitForTimeout(1200)
  await page.getByText(name, { exact: true }).first().click()
  await page.waitForTimeout(800)
}

// ─── 1. Chose nothing, closed the app, opened it again ────────────────────
{
  const page = await freshPage()
  console.log('[nothing] welcome  :', page.url(), await seen(page, 'Look around first'))
  await page.getByText('Look around first', { exact: false }).first().click()
  await page.waitForTimeout(6000)
  console.log('[nothing] browsing :', page.url(), '| db', JSON.stringify(await counts()))

  await page.reload({ waitUntil: 'load', timeout: 180000 })
  await page.waitForTimeout(14000)
  console.log('[nothing] reopened :', page.url())
  console.log('           welcome? :', await seen(page, 'Look around first'))
  console.log('           db       :', JSON.stringify(await counts()))
  await page.screenshot({ path: './shots/guest-nothing-reopened.png' })
  await page.context().close()
}

// ─── 2. Answered the two language questions, then closed the app ──────────
{
  const page = await freshPage()
  await page.getByText('Look around first', { exact: false }).first().click()
  await page.waitForTimeout(6000)
  console.log('[answered] languages:', page.url())

  await pickLanguage(page, 'Turkish')
  await page.getByText('Continue', { exact: true }).first().click()
  await page.waitForTimeout(1500)
  await pickLanguage(page, 'English')
  await page.getByText('Continue', { exact: true }).first().click()
  await page.waitForTimeout(2500)
  console.log('[answered] levels   :', page.url(), await seen(page, 'How well'))

  const pill = page.getByRole('button', { name: /English/ }).first()
  await pill.click()
  await page.waitForTimeout(1000)
  await page.getByText('Look around first', { exact: false }).first().click()
  await page.waitForTimeout(8000)
  console.log('[answered] browsing :', page.url(), '| db', JSON.stringify(await counts()))
  await page.screenshot({ path: './shots/guest-answered-browsing.png' })

  await page.reload({ waitUntil: 'load', timeout: 180000 })
  await page.waitForTimeout(16000)
  console.log('[answered] reopened :', page.url())
  console.log('            welcome? :', await seen(page, 'Look around first'))
  console.log('            db       :', JSON.stringify(await counts()))
  await page.screenshot({ path: './shots/guest-answered-reopened.png' })
  await page.context().close()
}

await browser.close()
