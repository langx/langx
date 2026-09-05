import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';

const APPS = ['langx', 'hellotalk', 'tandem', 'hilokal'];

const b64 = f => `data:image/png;base64,${readFileSync(f).toString('base64')}`;

const cols = APPS.map(k => `
  <div class="col">
    <img class="hero" src="${b64(`dshero-${k}.png`)}" />
    <img class="body" src="${b64(`dscrop-${k}.png`)}" />
  </div>`).join('\n');

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #eceff1; font-family: 'Google Sans', Roboto, Arial, sans-serif; padding: 28px; width: 1720px; }
  .grid { display: flex; gap: 20px; align-items: flex-start; }
  .col { flex: 1; background: #fff; border-radius: 16px; overflow: hidden;
         box-shadow: 0 1px 4px rgba(0,0,0,.12); }
  .col img { display: block; width: 100%; }
  .hero { border-bottom: 1px solid #e0e0e0; }
  .caption { margin-top: 16px; text-align: center; color: #5f6368; font-size: 15px; }
</style></head>
<body>
  <div class="grid">${cols}</div>
  <div class="caption">Google Play &middot; Data safety &middot; play.google.com &middot; ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
</body></html>`;

writeFileSync('compose-privacy.html', html);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1720, height: 800 }, deviceScaleFactor: 2 });
await page.goto('file://./compose-privacy.html');
await page.waitForTimeout(500);
await page.screenshot({ path: 'privacy-comparison.png', fullPage: true });
console.log('written privacy-comparison.png');
await browser.close();
