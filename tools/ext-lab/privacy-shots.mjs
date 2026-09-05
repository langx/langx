import { chromium } from 'playwright';

const APPS = [
  { key: 'langx', url: 'https://apps.apple.com/us/app/langx-practice-learn-succeed/id6474187141' },
  { key: 'hellotalk', url: 'https://apps.apple.com/us/app/hellotalk-language-learning/id557130558' },
  { key: 'tandem', url: 'https://apps.apple.com/us/app/tandem-conversation-exchange/id959001619' },
  { key: 'hilokal', url: 'https://apps.apple.com/us/app/hilokal-language-exchange-app/id1537500613' },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1100, height: 2400 },
  deviceScaleFactor: 2,
  colorScheme: 'light',
  locale: 'en-US',
});

for (const app of APPS) {
  const page = await ctx.newPage();
  console.log(`--- ${app.key}`);
  await page.goto(app.url, { waitUntil: 'networkidle', timeout: 60000 }).catch(e => console.log('goto:', e.message));
  // Find the App Privacy section
  const heading = page.locator('h2', { hasText: 'App Privacy' }).first();
  try {
    await heading.waitFor({ timeout: 15000 });
  } catch {
    console.log('no App Privacy h2 found; dumping h2 texts:');
    console.log(await page.locator('h2').allTextContents());
    await page.screenshot({ path: `privacy-${app.key}-full.png`, fullPage: true });
    await page.close();
    continue;
  }
  const section = heading.locator('xpath=ancestor::section[1]');
  const target = (await section.count()) ? section : heading.locator('xpath=..');
  await target.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  await target.screenshot({ path: `privacy-${app.key}.png` });
  const box = await target.boundingBox();
  console.log('captured', app.key, box);
  await page.close();
}

await browser.close();
