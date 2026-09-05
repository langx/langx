import { chromium } from 'playwright'

const cases = [
  { locale: 'en-US', expect: /Welcome back|Sign in/i, dir: 'ltr' },
  { locale: 'tr-TR', expect: /Tekrar hoş geldin|Giriş yap/i, dir: 'ltr' },
  { locale: 'ar-EG', expect: /أهلًا بعودتك|تسجيل الدخول/, dir: 'rtl' },
  { locale: 'ru-RU', expect: /С возвращением|Войти/, dir: 'ltr' },
  { locale: 'pt-PT', expect: /Que bom te ver|Entrar/i, dir: 'ltr' }, // pt-PT must land on pt-BR
]

const browser = await chromium.launch({ args: ['--no-sandbox'] })
let failures = 0

for (const c of cases) {
  const context = await browser.newContext({ locale: c.locale })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto('http://localhost:8081/(auth)/sign-in', { waitUntil: 'networkidle', timeout: 180000 })
  await page.waitForTimeout(2500)

  const text = await page.innerText('body')
  const dir = await page.evaluate(() => document.documentElement.dir || 'ltr')
  const ok = c.expect.test(text)
  const dirOk = dir === c.dir

  console.log(`${c.locale}: text ${ok ? 'OK' : 'FAIL'} | dir ${dir} ${dirOk ? 'OK' : 'FAIL'}${errors.length ? ` | ${errors.length} page errors` : ''}`)
  if (!ok || !dirOk) {
    failures++
    console.log('   first 300 chars:', JSON.stringify(text.slice(0, 300)))
    if (errors.length) console.log('   error:', errors[0].slice(0, 300))
  }
  await page.screenshot({ path: `/tmp/i18n/smoke/${c.locale}.png`, fullPage: false })
  await context.close()
}

await browser.close()
console.log(failures === 0 ? 'ALL OK' : `${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
