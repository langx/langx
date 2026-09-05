import { chromium } from 'playwright';

const APPS = [
  { key: 'langx', pkg: 'tech.newchapter.languageXchange' },
  { key: 'hellotalk', pkg: 'com.hellotalk' },
  { key: 'tandem', pkg: 'net.tandem' },
  { key: 'hilokal', pkg: 'com.hilokal' },
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

  const clip = await page.evaluate(() => {
    // Top: the hero block that holds the app icon + name (climb from h1 until an img is inside)
    const h1 = document.querySelector('h1');
    let hero = h1.parentElement;
    while (hero && !hero.querySelector('img')) hero = hero.parentElement;
    const heroRect = hero.getBoundingClientRect();
    // Bottom: the "For more information..." note after Security practices
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let endY = document.body.scrollHeight;
    while (walker.nextNode()) {
      const t = walker.currentNode.textContent;
      if (t && t.includes('For more information about collected')) {
        endY = walker.currentNode.parentElement.getBoundingClientRect().top + window.scrollY;
        break;
      }
    }
    const top = heroRect.top + window.scrollY - 12;
    return { x: 0, y: top, width: 520, height: endY - top - 8 };
  });

  console.log(app.key, clip);
  await page.screenshot({ path: `dscrop-${app.key}.png`, fullPage: true, clip });
  await page.close();
}
await browser.close();
