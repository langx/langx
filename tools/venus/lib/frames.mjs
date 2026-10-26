// SVG -> PNG with headless Chromium (playwright-core), the engine the style folders and days/ use,
// plus text measuring in the same browser so caption wrapping matches what is drawn.
//
// Throughput note (measured on a 12-core Mac): one browser tops out near 90 ms a frame however
// many pages it has; separate browser processes scale, so batch.mjs runs several renders at once.
//
// Playwright is not a dependency of this repo (see tools/promo-video/README.md for why): point
// VENUS_PLAYWRIGHT at an installed playwright or playwright-core (its index.mjs, or a package name).
// CHROME is the browser binary; without it Playwright launches the Chromium it downloaded.
import fs from 'node:fs'
import path from 'node:path'
import { GEN, REPO } from './paths.mjs'
const PLAYWRIGHT = process.env.VENUS_PLAYWRIGHT ?? 'playwright'
const loaded = await import(PLAYWRIGHT).catch(() => null)
if (!loaded)
  throw new Error(
    `cannot import "${PLAYWRIGHT}": install playwright or set VENUS_PLAYWRIGHT to its index.mjs`,
  )
const { chromium } = loaded
const CHROME = process.env.CHROME || undefined
// Nunito is the app's own copy (apps/mobile depends on @expo-google-fonts/nunito), so run
// `pnpm install` first
const FONTS = path.join(REPO, 'apps/mobile/node_modules/@expo-google-fonts/nunito')
const font = (f) =>
  'data:font/ttf;base64,' +
  fs.readFileSync(path.join(FONTS, f.replace(/^Nunito_(.+)\.ttf$/, '$1'), f)).toString('base64')
const FONT_CSS = [700, 800, 900]
  .map(
    (w) =>
      `@font-face{font-family:Nunito;font-weight:${w};src:url(${font(`Nunito_${w}${{ 700: 'Bold', 800: 'ExtraBold', 900: 'Black' }[w]}.ttf`)})}`,
  )
  .join('')
// the end card's Arabic face (a variable font, so one file covers every weight)
const AR_FONT =
  'data:font/ttf;base64,' +
  fs.readFileSync(path.join(GEN, 'assets/endcard/fonts/NotoSansArabic.ttf')).toString('base64')
const FONT_CSS_ALL =
  FONT_CSS + `@font-face{font-family:'Noto Sans Arabic';font-weight:100 900;src:url(${AR_FONT})}`

export async function openBrowser() {
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  })
  const newPage = async () => {
    const page = await browser.newPage({ deviceScaleFactor: 1 })
    await page.setContent(
      `<!doctype html><html><head><style>${FONT_CSS_ALL}html,body{margin:0;padding:0;background:transparent}#s{display:block}</style></head><body><div id="s"></div></body></html>`,
    )
    await page.evaluate(() =>
      Promise.all([
        document.fonts.load('900 40px Nunito'),
        document.fonts.load('800 40px Nunito'),
        document.fonts.load('700 40px Nunito'),
        document.fonts.load("700 40px 'Noto Sans Arabic'", 'تكلّم'),
      ]),
    )
    return page
  }
  let mpage = null
  return {
    browser,
    // widths in px of each string at `weight size family` (canvas measureText: same shaping and fallback as the SVG text)
    async measure(strings, css) {
      mpage = mpage || (await newPage())
      return mpage.evaluate(
        ([ss, f]) => {
          const c = document.createElement('canvas').getContext('2d')
          c.font = f
          return ss.map((s) => c.measureText(s).width)
        },
        [strings, css],
      )
    },
    // items: [{ svg, w, h, out, transparent }]
    async render(items, pages = 4) {
      const per = Math.ceil(items.length / pages)
      await Promise.all(
        Array.from({ length: pages }, async (_, i) => {
          const mine = items.slice(i * per, (i + 1) * per)
          if (!mine.length) return
          const page = await newPage()
          let size = ''
          for (const it of mine) {
            const sz = it.w + 'x' + it.h
            if (sz !== size) {
              await page.setViewportSize({ width: it.w, height: it.h })
              size = sz
            }
            await page.evaluate(
              (h) => {
                document.getElementById('s').innerHTML = h
              },
              typeof it.svg === 'function' ? it.svg() : it.svg,
            )
            const buf = await page.screenshot({
              type: 'png',
              omitBackground: !!it.transparent,
              clip: { x: 0, y: 0, width: it.w, height: it.h },
            })
            fs.mkdirSync(path.dirname(it.out), { recursive: true })
            fs.writeFileSync(it.out, buf)
          }
          await page.close()
        }),
      )
    },
    close: () => browser.close(),
  }
}
