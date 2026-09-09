// 9 September 2026: the Fluent → Polyglot upgrade path under the fake store.
// Rewritten from the 5 September version, which clicked offer rows ("Monthly —
// TEST $4.99") that the segmented paywall no longer has.
//
// Needs the web build on :8081 with EXPO_PUBLIC_REVENUECAT_FAKE_STORE=1, an API
// with REVENUECAT_FAKE_STORE=true, a seeded account on the free tier, and
// ./shots/ to exist. Every check prints a line and the script exits non-zero on
// the first failure, so it is usable from a shell loop.
//
// It cannot exercise the web portal: `viaPortal` requires the fake store to be
// off, and without it there is nothing to buy on a laptop. The AppState refresh
// that follows a portal return is unverified here by design.
import { chromium } from 'playwright'

const B = 'http://localhost:8081'
const fails = []
function check(name, ok, detail) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok || detail === undefined ? '' : ` — ${detail}`}`)
  if (!ok) fails.push(name)
}

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(e.message))

await page.goto(B, { waitUntil: 'load', timeout: 180000 })
await page.waitForTimeout(8000)
for (let i = 0; i < 4 && page.url().includes('/intro'); i++) {
  const s = page.getByText(/^Skip$/).first()
  if (await s.count()) {
    await s.click()
    await page.waitForTimeout(2500)
  } else break
}
const haveAccount = page.getByText(/I already have an account/).first()
if (await haveAccount.count()) {
  await haveAccount.click()
  await page.waitForTimeout(3000)
}
const email = page.locator('input[type="email"], input[inputmode="email"]').first()
if (await email.count()) {
  await email.fill(process.env.TEST_EMAIL ?? 'test_anna@test.langx.invalid')
  await page
    .locator('input[type="password"]')
    .first()
    .fill(process.env.TEST_PASSWORD ?? 'TestUser!2026')
  await page.getByText(/^Sign in$/).last().click()
  await page.waitForTimeout(12000)
}
console.log('after sign-in:', page.url())

// The tier segments and the footer button, which together say which column the
// screen is on. `accessibilityState` is dropped by react-native-web, so there
// is no aria-selected to read — the button's label is the signal, and the
// Button uppercases its label in CSS, hence every regex here is case-blind.
const plans = () => page.getByRole('radiogroup', { name: 'Plans' })
const footer = () => page.getByRole('button').filter({ hasText: /fluent|polyglot|current plan/i })

async function openPaywall() {
  await page.goto(`${B}/paywall`, { waitUntil: 'load', timeout: 120000 })
  await plans().waitFor({ timeout: 60000 })
  await footer().first().waitFor({ timeout: 60000 })
  // The store call is separate from the render; the price arrives after it.
  await page.waitForTimeout(4000)
  return page.locator('body').innerText()
}

async function buttonLabel() {
  return (await footer().first().innerText()).trim()
}

async function pickTier(name) {
  await plans().getByText(new RegExp(`^${name}$`)).first().click()
  await page.waitForTimeout(1500)
}

async function buy() {
  await footer().first().click()
  await page.waitForTimeout(8000)
}

// 1. Free: opens on Fluent, and the button is live.
let body = await openPaywall()
check('free paywall opens on Fluent', /fluent/i.test(await buttonLabel()), await buttonLabel())
check(
  'free paywall button is enabled',
  (await footer().first().getAttribute('aria-disabled')) !== 'true',
)
await page.screenshot({ path: './shots/paywall-free.png', fullPage: true })

// 2. Buy Fluent, then reload — a cold `me` cache is the case a seeded useState
//    used to get wrong.
await buy()
body = await openPaywall()
check('after buying Fluent the paywall opens on Polyglot', /polyglot/i.test(await buttonLabel()))
check('the Polyglot column says what an upgrade costs', /Upgrading from Fluent/.test(body), body)
check('the Polyglot column lists what Fluent already gave', /Everything in Fluent/.test(body))
await page.screenshot({ path: './shots/paywall-fluent.png', fullPage: true })

// 3. The tier held names itself instead of offering itself.
await pickTier('Fluent')
check('the held tier reads "Your current plan"', /current plan/i.test(await buttonLabel()))
check(
  'the held tier is not buyable',
  (await footer().first().getAttribute('aria-disabled')) === 'true',
)

// 4. Settings and the Me tab, while on Fluent.
await page.goto(`${B}/settings/plan`, { waitUntil: 'load', timeout: 120000 })
await page.waitForTimeout(5000)
let settings = await page.locator('body').innerText()
check('Settings names the upgrade', /Upgrade to Polyglot/.test(settings), settings)
await page.screenshot({ path: './shots/settings-plan.png', fullPage: true })

await page.goto(`${B}/me`, { waitUntil: 'load', timeout: 120000 })
await page.waitForTimeout(5000)
let mine = await page.locator('body').innerText()
check('the Me card offers Polyglot', /Upgrade to Polyglot/.test(mine))
check('the Me card drops the quota line on a paid tier', !/New chats left today/.test(mine))

// 5. Buy Polyglot: nothing left to sell, nowhere left to upgrade.
await openPaywall()
await pickTier('Polyglot')
await buy()
await openPaywall()
check('the top tier reads "Your current plan"', /current plan/i.test(await buttonLabel()))
await pickTier('Fluent')
check('Fluent under Polyglot is explained, not offered', /Included in Polyglot/.test(await page.locator('body').innerText()))
await page.screenshot({ path: './shots/paywall-polyglot.png', fullPage: true })

await page.goto(`${B}/settings/plan`, { waitUntil: 'load', timeout: 120000 })
await page.waitForTimeout(5000)
settings = await page.locator('body').innerText()
check('Settings shows Polyglot', /Polyglot/.test(settings), settings)
check('the upgrade row is gone at the top tier', !/Upgrade to|See the plans/.test(settings))

await page.goto(`${B}/me`, { waitUntil: 'load', timeout: 120000 })
await page.waitForTimeout(5000)
mine = await page.locator('body').innerText()
check('the Me card is gone at the top tier', !/Go further|Upgrade to Polyglot/.test(mine))

check('no page errors', pageErrors.length === 0, pageErrors.join(' | '))

await browser.close()
console.log(fails.length ? `\n${fails.length} failed: ${fails.join(', ')}` : '\nall checks passed')
process.exitCode = fails.length ? 1 : 0
