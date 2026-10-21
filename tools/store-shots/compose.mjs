/**
 * Composes the raw captures into store tiles at every slot's exact pixel
 * size: a flat hue ground, the localized caption, and the capture inside a
 * plain ink bezel that runs off the bottom of the tile.
 *
 * Each tile is an HTML page photographed by headless Chrome at the slot's
 * size (device scale 1), so type is set by a browser, not scaled from a
 * smaller drawing. Every rule below is a ratio of the tile's width, taken from
 * the board (`V-StoreShots`, drawn at one fifth of the iPhone width), so one
 * rule fills every slot.
 *
 * The output is checked before this returns: exact size, PNG, no alpha
 * channel (both stores refuse alpha). A failed check throws.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { REPO } from './stack.mjs'
import {
  BUDGET,
  FEATURE_GRAPHIC,
  HUES,
  ORDER,
  PLAY_SKIPS,
  PRO_VARIANTS,
  RTL,
  SHOTS,
  SLOTS,
  captionsFor,
} from './shots.config.mjs'

const CHROME =
  process.env.SHOTS_CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const FONTS = join(REPO, 'apps/api/assets/fonts')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Width and height from the IHDR, and whether the colour type carries alpha. */
export function pngInfo(file) {
  const b = readFileSync(file)
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error(`${file} is not a PNG`)
  const colorType = b[25]
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), alpha: colorType === 4 || colorType === 6 }
}

async function openChrome(port) {
  const profile = join(process.env.TMPDIR ?? '/tmp', `store-shots-compose-${port}`)
  rmSync(profile, { recursive: true, force: true })
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--hide-scrollbars',
      '--allow-file-access-from-files',
      '--force-color-profile=srgb',
      'about:blank',
    ],
    { stdio: 'ignore' },
  )
  let target
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(250)
    try {
      target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(
        (t) => t.type === 'page',
      )
    } catch {
      // not listening yet
    }
  }
  if (!target) {
    chrome.kill()
    throw new Error('headless Chrome did not start')
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  let seq = 0
  const pending = new Map()
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m)
      pending.delete(m.id)
    }
  })
  const send = (method, params = {}) =>
    new Promise((r) => {
      const id = ++seq
      pending.set(id, r)
      ws.send(JSON.stringify({ id, method, params }))
    })
  await send('Page.enable')
  return {
    send,
    async close() {
      ws.close()
      chrome.kill()
      await sleep(300)
      rmSync(profile, { recursive: true, force: true })
    },
  }
}

/** Renders one HTML file to one PNG of exactly w×h. */
async function photograph(browser, htmlFile, out, w, h) {
  await browser.send('Emulation.setDeviceMetricsOverride', {
    width: w,
    height: h,
    deviceScaleFactor: 1,
    mobile: false,
  })
  const loaded = new Promise((resolve) => {
    const poll = async () => {
      const r = await browser.send('Runtime.evaluate', {
        expression: 'window.__ready === true',
        returnByValue: true,
      })
      if (r.result?.result?.value) resolve()
      else setTimeout(poll, 100)
    }
    setTimeout(poll, 200)
  })
  await browser.send('Page.navigate', { url: pathToFileURL(htmlFile).href })
  await Promise.race([loaded, sleep(15000)])
  const shot = await browser.send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: 0, y: 0, width: w, height: h, scale: 1 },
  })
  writeFileSync(out, Buffer.from(shot.result.data, 'base64'))
  const info = pngInfo(out)
  if (info.w !== w || info.h !== h) throw new Error(`${out}: ${info.w}×${info.h}, wanted ${w}×${h}`)
  if (info.alpha) throw new Error(`${out} has an alpha channel`)
}

const fontFaces = `
@font-face{font-family:'Nunito';font-weight:900;src:url('${pathToFileURL(join(FONTS, 'Nunito_900Black.ttf')).href}')}
@font-face{font-family:'Nunito';font-weight:600;src:url('${pathToFileURL(join(FONTS, 'Nunito_600SemiBold.ttf')).href}')}
@font-face{font-family:'Noto Sans Arabic';font-weight:600;src:url('${pathToFileURL(join(FONTS, 'NotoSansArabic_600SemiBold.ttf')).href}')}`

const IOS_ICONS = `<svg viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="currentColor"/><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="currentColor"/><rect x="10" y="3" width="3" height="9" rx="1" fill="currentColor"/><rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor"/></svg>
<svg viewBox="0 0 16 12"><path d="M8 12 5.6 9.2a3.4 3.4 0 0 1 4.8 0zM3.4 7a6.6 6.6 0 0 1 9.2 0l-1.6 1.7a4.4 4.4 0 0 0-6 0zM1.1 4.6a9.9 9.9 0 0 1 13.8 0l-1.5 1.6a7.8 7.8 0 0 0-10.8 0z" fill="currentColor"/></svg>
<svg viewBox="0 0 27 12"><rect x="0.5" y="0.5" width="23" height="11" rx="3" fill="none" stroke="currentColor" opacity="0.4"/><rect x="2" y="2" width="20" height="8" rx="2" fill="currentColor"/><rect x="25" y="4" width="1.6" height="4" rx="0.8" fill="currentColor" opacity="0.4"/></svg>`
// Android's own shapes — a Play tile never carries an iPhone status bar.
const ANDROID_ICONS = `<svg viewBox="0 0 14 12"><path d="M7 12 0 3.2a11 11 0 0 1 14 0z" fill="currentColor"/></svg>
<svg viewBox="0 0 12 12"><path d="M12 0v12H0z" fill="currentColor"/></svg>
<svg viewBox="0 0 7 12"><rect x="2" y="0" width="3" height="1.5" fill="currentColor"/><rect x="0" y="1.5" width="7" height="10.5" rx="1" fill="currentColor"/></svg>`

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

/**
 * One tile. `geometry` is in fractions of the tile width (W), except the
 * phone's top, which follows the caption: the caption is measured in the
 * page and the phone sits under it, so a locale that runs to three lines
 * pushes the phone down instead of under its own words.
 */
function tileHtml({ slot, id, locale, caption, capture, cut, store }) {
  const W = slot.w
  const shot = SHOTS[id]
  const ground = HUES[shot.ground]
  const dark = shot.ground === 'ink' || shot.ground === 'blue'
  const ink = dark ? '#ffffff' : '#14161b'
  const sub = dark ? 'rgba(255,255,255,0.86)' : '#2b2e35'
  const rtl = RTL.includes(locale)
  const tall = slot.h / slot.w > 2
  const tablet = slot.kind === 'tablet'
  // The board: iPhone phone 83.6% of the tile, Play 77.6%, iPad 56.2%.
  let phoneW = tablet ? (slot.h / slot.w > 1.5 ? 0.66 : 0.562) : tall ? 0.836 : 0.776
  const pad = (tablet ? 0.091 : 0.076) * W
  const headline = (tablet ? 0.068 : 0.0795) * W
  const support = (tablet ? 0.04 : 0.0455) * W
  const island = slot.bezel === 'island'
  const pw = phoneW * W
  const bez = pw * 0.0227
  const sw = pw - 2 * bez
  // The screen: a drawn status bar over the capture, at the phone's ratio.
  const statusH = sw * (island ? 62 / 440 : 0.09)
  const capH = sw * (capture.h / capture.w)
  const sh = statusH + capH
  const outerR = pw * (island ? 0.154 : 0.107)
  const innerR = outerR - bez
  const supportFont =
    store === 'play'
      ? "'Roboto','Nunito',system-ui,sans-serif"
      : "-apple-system,'SF Pro Text',system-ui,sans-serif"
  const arabic = rtl ? "'Noto Sans Arabic'," : ''
  // `no-prices`: lower the phone until the cut line meets the tile's bottom.
  const lowerTo = cut ? statusH + cut * capH : null
  return `<!doctype html><html lang="${locale}" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto:wght@500&display=block">
<style>${fontFaces}
*{box-sizing:border-box;margin:0}
html,body{width:${W}px;height:${slot.h}px;overflow:hidden;background:${ground}}
.cap{position:absolute;left:${pad}px;right:${pad}px;top:${(tablet ? 0.068 : 0.08) * W}px;display:flex;flex-direction:column;gap:${0.022 * W}px;text-align:${rtl ? 'right' : 'left'}}
.h{font-family:${arabic}'Nunito',sans-serif;font-weight:900;color:${ink};font-size:${headline}px;line-height:1.14;letter-spacing:${-0.01 * headline}px}
.s{font-family:${arabic}${supportFont};font-weight:600;color:${sub};font-size:${support}px;line-height:1.33}
.phone{position:absolute;left:${(W - pw) / 2}px;width:${pw}px;height:${sh + 2 * bez}px;padding:${bez}px;border-radius:${outerR}px;background:#14161b}
.screen{position:relative;width:${sw}px;height:${sh}px;border-radius:${innerR}px;overflow:hidden;background:#fff}
.status{position:absolute;left:0;top:0;width:100%;height:${statusH}px;display:flex;align-items:center;justify-content:space-between;padding:0 ${sw * 0.085}px;font:600 ${statusH * (island ? 0.3 : 0.33)}px -apple-system,system-ui,sans-serif;direction:ltr}
.status svg{height:${statusH * 0.24}px;width:auto;margin-left:${sw * 0.012}px}
.cutout{position:absolute;left:50%;transform:translateX(-50%);background:#000}
.shot{position:absolute;left:0;top:${statusH}px;width:${sw}px;height:${capH}px}
</style></head><body>
<div class="cap" id="cap"><div class="h">${esc(caption[0])}</div><div class="s">${esc(caption[1])}</div></div>
<div class="phone" id="phone"><div class="screen">
<div class="status" id="status"><span>9:41</span><span style="display:flex;align-items:center">
${island ? IOS_ICONS : ANDROID_ICONS}
</span></div>
<img class="shot" id="shot" src="${pathToFileURL(capture.file).href}">
${
  island
    ? `<div class="cutout" style="top:${sw * 0.025}px;width:${sw * 0.286}px;height:${sw * 0.084}px;border-radius:${sw * 0.05}px"></div>`
    : `<div class="cutout" style="top:${statusH * 0.25}px;width:${statusH * 0.5}px;height:${statusH * 0.5}px;border-radius:50%"></div>`
}
</div></div>
<script>
(async () => {
  await document.fonts.ready
  // A headline past two lines steps down until it fits (a long locale).
  const h = document.querySelector('.h')
  let size = ${headline}
  while (h.getBoundingClientRect().height > size * 1.14 * 2.05 && size > ${headline * 0.7}) { size -= 2; h.style.fontSize = size + 'px' }
  const capBottom = document.getElementById('cap').getBoundingClientRect().bottom
  const phone = document.getElementById('phone')
  const lowerTo = ${lowerTo === null ? 'null' : lowerTo}
  let top = capBottom + ${0.06 * W}
  if (lowerTo !== null) top = Math.max(top, ${slot.h} - ${bez} - lowerTo)
  // fit: 'whole' — the phone shrinks, from its top edge, until all of it
  // fits under the caption.
  if (${shot.fit === 'whole'}) {
    const room = ${slot.h} - top - ${0.04 * W}
    const k = Math.min(1, room / phone.offsetHeight)
    phone.style.transformOrigin = '50% 0'
    phone.style.transform = 'scale(' + k + ')'
  }
  phone.style.top = top + 'px'
  // The status bar takes the colour of the screen's first row, and its text
  // whichever of ink or white reads on it.
  const img = document.getElementById('shot')
  await img.decode()
  const c = document.createElement('canvas'); c.width = 4; c.height = 1
  const g = c.getContext('2d'); g.drawImage(img, 0, 0, img.naturalWidth, 1, 0, 0, 4, 1)
  const [r, gg, b] = g.getImageData(1, 0, 1, 1).data
  const status = document.getElementById('status')
  status.style.background = 'rgb(' + r + ',' + gg + ',' + b + ')'
  status.style.color = (0.299 * r + 0.587 * gg + 0.114 * b) > 150 ? '#000' : '#fff'
  window.__ready = true
})()
</script></body></html>`
}

/** The Play feature graphic: the board's drawing, wordless but for the name. */
function featureGraphicHtml() {
  return readFileSync(new URL('./feature-graphic.html', import.meta.url), 'utf8').replace(
    '/*FONTS*/',
    fontFaces,
  )
}

/**
 * Composes one locale. `rawDir` holds `<id>.png` and `meta.json` from the
 * capture; output goes to `<outDir>/<locale>/<slot dir>/NN.png`.
 */
export async function composeLocale({ locale, rawDir, outDir, playLocale, cdpPort = 9371 }) {
  const captions = captionsFor(locale)
  for (const id of ORDER) {
    const [h, s] = captions[id]
    if (h.length > BUDGET.headline || s.length > BUDGET.support) {
      console.warn(
        `  ! ${locale}/${id} is over the length budget (${h.length}/${BUDGET.headline}, ${s.length}/${BUDGET.support})`,
      )
    }
  }
  const meta = JSON.parse(readFileSync(join(rawDir, 'meta.json'), 'utf8'))
  const work = join(outDir, '.tiles')
  mkdirSync(work, { recursive: true })
  const browser = await openChrome(cdpPort)
  const manifest = {}
  try {
    for (const slot of SLOTS) {
      if (slot.store === 'play' && !playLocale) continue
      const ids = slot.store === 'play' ? ORDER.filter((id) => !PLAY_SKIPS.includes(id)) : ORDER
      const dir = join(outDir, locale, slot.dir)
      mkdirSync(dir, { recursive: true })
      for (const [index, id] of ids.entries()) {
        const file = join(rawDir, `${id}.png`)
        const info = pngInfo(file)
        const variants = id === 'pro' ? PRO_VARIANTS : [null]
        for (const variant of variants) {
          const nn = String(index + 1).padStart(2, '0')
          // The first variant is the one in the upload folder; the other goes
          // under alt/, so dragging the folder's files uploads one set.
          const name =
            variant && variant !== PRO_VARIANTS[0] ? `alt/${nn}-${variant}.png` : `${nn}.png`
          const cut = variant === 'no-prices' ? (meta[id]?.cut?.at ?? null) : null
          if (variant === 'no-prices' && cut === null)
            throw new Error(`${locale}/${id}: no cut line for the no-prices variant`)
          if (name.startsWith('alt/')) mkdirSync(join(dir, 'alt'), { recursive: true })
          const html = join(work, `${slot.dir.replace('/', '-')}-${name.replace('/', '-')}.html`)
          writeFileSync(
            html,
            tileHtml({
              slot,
              id,
              locale,
              caption: captions[id],
              capture: { file, w: info.w, h: info.h },
              cut,
              store: slot.store,
            }),
          )
          await photograph(browser, html, join(dir, name), slot.w, slot.h)
          ;(manifest[slot.dir] ??= {})[name] = {
            id,
            ...(variant ? { variant } : {}),
            headline: captions[id][0],
            support: captions[id][1],
          }
        }
      }
      console.log(`  composed ${locale} ${slot.dir} (${slot.w}×${slot.h})`)
    }
  } finally {
    await browser.close()
    rmSync(work, { recursive: true, force: true })
  }
  return manifest
}

export async function composeFeatureGraphic(outDir, cdpPort = 9372) {
  const html = join(outDir, '.feature-graphic.html')
  writeFileSync(html, featureGraphicHtml())
  const browser = await openChrome(cdpPort)
  try {
    await photograph(
      browser,
      html,
      join(outDir, FEATURE_GRAPHIC.file),
      FEATURE_GRAPHIC.w,
      FEATURE_GRAPHIC.h,
    )
  } finally {
    await browser.close()
    rmSync(html, { force: true })
  }
  console.log(`  composed ${FEATURE_GRAPHIC.file} (${FEATURE_GRAPHIC.w}×${FEATURE_GRAPHIC.h})`)
}
