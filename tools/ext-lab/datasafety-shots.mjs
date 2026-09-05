import { chromium } from 'playwright';

const APPS = [
  { key: 'langx', pkg: 'tech.newchapter.languageXchange', name: 'LangX' },
  { key: 'hellotalk', pkg: 'com.hellotalk', name: 'HelloTalk' },
  { key: 'tandem', pkg: 'net.tandem', name: 'Tandem' },
  { key: 'hilokal', pkg: 'com.hilokal', name: 'Hilokal' },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 520, height: 1000 },
  deviceScaleFactor: 2,
  colorScheme: 'light',
  locale: 'en-US',
});

for (const app of APPS) {
  const page = await ctx.newPage();
  const url = `https://play.google.com/store/apps/datasafety?id=${app.pkg}&hl=en_US`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(e => console.log('goto:', e.message));
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `ds-${app.key}.png`, fullPage: true });
  console.log(app.key, 'done, height:', await page.evaluate(() => document.body.scrollHeight));
  await page.close();
}
await browser.close();
