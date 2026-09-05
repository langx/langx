import { chromium } from 'playwright'
const b = await chromium.launch()
for (const [w, name] of [[1280,'desktop'],[900,'mid'],[420,'phone']]) {
  const p = await b.newPage({ viewport: { width: w, height: 1000 } })
  await p.goto('http://localhost:8899/#using-langx-tokens', { waitUntil: 'networkidle' })
  const el = await p.$('#using-langx-tokens')
  await el.evaluate(n => n.closest('section').scrollIntoView())
  await p.waitForTimeout(300)
  await p.screenshot({ path: `/tmp/token-spend-${name}.png`, clip: await (await p.$('section:has(#using-langx-tokens)')).boundingBox() })
  await p.close()
}
await b.close()
console.log('shot')
