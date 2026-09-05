import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--no-sandbox'] })
const p = await (await b.newContext({ viewport: { width: 420, height: 140 }, deviceScaleFactor: 2 })).newPage()
await p.goto('file:///tmp/sizes.html')
await p.waitForTimeout(3000)
await p.screenshot({ path: './shots/avatars-3-sizes.png' })
await b.close()
