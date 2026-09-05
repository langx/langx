import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const EXT = path.resolve("demo-ext");
const HEADLESS = process.env.MODE === "headless";

// test sayfasini localhost:8099 uzerinden sun (content script http://localhost/* ile eslesiyor)
const html = fs.readFileSync("page.html");
const srv = http.createServer((_q, r) => { r.writeHead(200, {"content-type":"text/html"}); r.end(html); });
await new Promise(res => srv.listen(8099, "127.0.0.1", res));

const ctx = await chromium.launchPersistentContext("/tmp/ext-profile", {
  headless: HEADLESS,
  channel: HEADLESS ? "chromium" : undefined,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, "--no-sandbox"],
});

const ok = [];
const fail = [];

// 1) service worker kayitli mi
let sw = ctx.serviceWorkers()[0];
if (!sw) sw = await ctx.waitForEvent("serviceworker", { timeout: 15000 }).catch(() => null);
sw ? ok.push("service worker calisiyor: " + sw.url().slice(0, 60)) : fail.push("service worker YOK");

const extId = sw ? new URL(sw.url()).host : null;

const page = await ctx.newPage();
await page.goto("http://localhost:8099/", { waitUntil: "load" });

// 2) content script enjekte oldu mu
const marker = await page.locator("#langx-ext-marker").textContent().catch(() => null);
marker ? ok.push("content script: " + marker) : fail.push("content script enjekte OLMADI");

// 3) content script <-> service worker mesajlasmasi
const reply = await page.locator("#langx-ext-sw-reply").textContent().catch(() => null);
reply && reply.includes("pong") ? ok.push("mesajlasma: " + reply) : fail.push("SW mesajlasmasi calismadi (" + reply + ")");

// 4) chrome.storage service worker icinde okunabiliyor mu
if (sw) {
  const v = await sw.evaluate(() => chrome.storage.local.get("installedAt")).catch(e => ({ err: String(e) }));
  v?.installedAt === "ok" ? ok.push("chrome.storage.local okundu") : fail.push("storage okunamadi: " + JSON.stringify(v));
}

// 5) eklentinin kendi sayfasi acilabiliyor mu (chrome-extension://)
if (extId) {
  const p2 = await ctx.newPage();
  const r = await p2.goto(`chrome-extension://${extId}/manifest.json`).catch(() => null);
  r && r.ok() ? ok.push("chrome-extension:// URL acildi") : fail.push("chrome-extension:// acilamadi");
}

await page.bringToFront();
await page.screenshot({ path: `sonuc-${HEADLESS ? "headless" : "xvfb"}.png` });

console.log(`\n--- MOD: ${HEADLESS ? "headless (xvfb yok)" : "headed (xvfb altinda)"} ---`);
ok.forEach(l => console.log("  GECTI  " + l));
fail.forEach(l => console.log("  KALDI  " + l));
console.log(`  ozet: ${ok.length} gecti, ${fail.length} kaldi`);

await ctx.close(); srv.close();
process.exit(fail.length ? 1 : 0);
