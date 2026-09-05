import { chromium } from 'playwright';

const APPS = [
  { key: 'langx', pkg: 'tech.newchapter.languageXchange', title: 'LangX' },
  { key: 'hellotalk', pkg: 'com.hellotalk', title: 'HelloTalk' },
  { key: 'tandem', pkg: 'net.tandem', title: 'Tandem' },
  { key: 'hilokal', pkg: 'com.hilokal', title: 'Hilokal' },
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

  const clip = await page.evaluate((title) => {
    // Find the element whose text is the app title (largest heading containing it)
    const all = [...document.querySelectorAll('h1,h2,div,span')];
    const el = all.find(e => e.children.length === 0 && e.textContent.trim().startsWith(title));
    if (!el) return null;
    let hero = el.parentElement;
    while (hero && !hero.querySelector('img')) hero = hero.parentElement;
    const r = hero.getBoundingClientRect();
    return { x: 0, y: r.top + window.scrollY, width: 520, height: r.height, tag: hero.tagName };
  }, app.title);

  console.log(app.key, clip);
  if (clip) {
    await page.screenshot({ path: `dshero-${app.key}.png`, fullPage: true, clip: { x: clip.x, y: clip.y, width: clip.width, height: clip.height } });
  }
  await page.close();
}
await browser.close();
