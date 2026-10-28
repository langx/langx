# store-shots

The App Store and Google Play screenshots for app 3.1, from the real app:
seeded demo data, captured screens, composed into store tiles at every size
each store takes. One command does all of it; nothing is uploaded anywhere.

```bash
pnpm install                                   # in this checkout — never borrow another's node_modules
node tools/store-shots/run.mjs --out ../store-shots-3.1
node tools/store-shots/run.mjs --out ../store-shots-3.1 --locales en      # one locale
node tools/store-shots/run.mjs --out ../store-shots-3.1 --reuse-web       # skip the web export
node tools/store-shots/run.mjs --out ../store-shots-3.1 --skip-capture    # recompose only
```

Needs Google Chrome or Chromium in its usual install location (see
`chrome.mjs`) and about ten minutes for all eight locales, more on a slow
connection: Venus's covers and videos load from the media bucket, and each
shot waits for them. `--out` must be a
directory of its own outside the repository; `--locales` takes only the eight
known ones. Then **open `<out>/<locale>/contact.html` and look at
every tile** — the checks catch a wrong size, not a toast in frame.

## What it does

| Step    | File               | What                                                                                                                                        |
| ------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| export  | `stack.mjs`        | `expo export --platform web` of this checkout, pointed at the stack's API                                                                   |
| stack   | `stack.mjs`        | in-memory replica set + this checkout's API on its own ports, in a clean environment (no mail, push, store or cloud DB)                     |
| seed    | `seed.mts`         | @sofia's world through the module functions: threads, corrections, Echo cards, a 34-day streak, a balance                                   |
| browser | `chrome.mjs`       | finds and launches headless Chrome (argument array, fresh temp profile); page code gets its values as call arguments, never as built source |
| capture | `capture.mjs`      | headless Chrome over CDP, 440×894 pt at 3× (the 6.9″ width, minus the status bar), light mode, per locale                                   |
| compose | `compose.mjs`      | each tile an HTML page photographed at the slot's exact size; hue ground, caption, ink bezel, drawn status bar                              |
| check   | `run.mjs`          | every file's size, PNG without alpha, count per slot; `manifest.json`; a contact sheet per locale                                           |
| words   | `shots.config.mjs` | order, grounds, capture recipes, captions in eight locales, slots — the only file to edit for a change of order or wording                  |

Ports are 27170 (mongo), 4870 (API), 8870 (web), 9370–9372 (Chrome);
`SHOTS_MONGO_PORT`, `SHOTS_API_PORT` and `SHOTS_WEB_PORT` move them. The run
refuses to start if any is taken, and never uses :4000. Everything it starts
it stops through its own handles.

The demo viewer is **Sofia (@sofia)**. Her partners are fixture accounts
(`demo_*` handles on `test.langx.invalid`) whose ids are drawn so each keeps
the board's hue: Anna lilac, George tangerine, Yuki mint.

The stack runs with the flags production runs with (`v3Home`, `copilotEnabled`,
`venusStories`, `whatsappStickers`; the rest off), and on one clock: the seed,
the API and the browser all keep a fixed-offset zone where the run starts at
about 20:00 (`TIMEZONE` in `stack.mjs`), so every locale shows the same day
and Home says "Good evening".

**Venus** is the one thing read from outside the stack. Her videos' manifest,
covers and videos come from the public media bucket, read only. The bucket
answers CORS for the app's own origins, not for localhost, so the capture
fetches the manifest itself and hands it to the page (`serveVenusManifest`);
the covers and videos load as plain media.

## Output

```
<out>/
  android-feature-graphic.png              1024 × 500
  manifest.json                            number → id → caption, per locale and slot
  <locale>/contact.html
  <locale>/ios/6.9/01.png … 09.png         1320 × 2868
  <locale>/ios/6.3/01.png … 09.png         1206 × 2622
  <locale>/ios/5.5/01.png … 09.png         1242 × 2208
  <locale>/ios/13/01.png  … 09.png         2064 × 2752
  <locale>/android/phone/01.png … 08.png   1440 × 2560   (Play locales only)
  <locale>/android/7tablet/…               1080 × 1920
  <locale>/android/10tablet/…              1440 × 2560
  <locale>/ppo/ios/<slot>/01.png …         PPO shots (`PPO`), App Store slots only
```

Numbers are store order, zero-padded so a plain sort is the order. Play skips
`home`, so Play's 06 is `store`. Shot 9 (Pro) shows no prices: the phone is
lowered until the purchase area runs off the tile, so the listing never
carries one storefront's price into the others.

Shot 8 is Venus's page at her videos (3.0 had Badges there). The `ppo/` tree
holds shots made for a product page optimization treatment rather than the
listing — `venusLead`, today's Venus video, as the lead of a Venus-led test —
so a listing slot's count stays the store order's.

To upload, copy the set into the branding checkout without the run's working
files, then run the two collect scripts in `apps/mobile/scripts`, which read
`branding/3.x`:

```bash
rsync -a --exclude .work ../store-shots-3.1/ ../branding/3.x/
node apps/mobile/scripts/collect-store-screenshots.mjs   # then fastlane deliver
node apps/mobile/scripts/collect-play-screenshots.mjs    # then fastlane android play
```

## Sizes, and where they come from

Checked 21 Oct 2026.

| Store     | Slot                                 | Size                      | Rule                                                                         |
| --------- | ------------------------------------ | ------------------------- | ---------------------------------------------------------------------------- |
| App Store | iPhone 6.9″ (Dynamic Island, large)  | 1320 × 2868               | one of the accepted sizes                                                    |
| App Store | iPhone 6.3″ (Dynamic Island, medium) | 1206 × 2622               | Apple's "required device sizes" now names this display for iPhone            |
| App Store | iPhone 5.5″ (Home button, large)     | 1242 × 2208               | optional                                                                     |
| App Store | iPad 13″                             | 2064 × 2752               | required when the app runs on iPad                                           |
| Play      | phone                                | 1440 × 2560               | 320–3840 px, long side ≤ 2× short; 9:16 at ≥ 1080 px qualifies for promotion |
| Play      | 7″ / 10″ tablet                      | 1080 × 1920 / 1440 × 2560 | 1080–7680 px, 9:16 portrait                                                  |
| Play      | feature graphic                      | 1024 × 500                | JPEG or 24-bit PNG, no alpha                                                 |

App Store: up to 10 per size, `.png`/`.jpg`, no alpha.
Play: up to 8 per device type.

- Apple, [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications)
- Google, [Add preview assets to showcase your app](https://support.google.com/googleplay/android-developer/answer/9866151)

## What the web build cannot show

The captures come from the web export, which is the same code as the apps but
not the same build:

- **No real status bar.** The composer draws one (9:41, full battery), iOS or
  Android shapes by slot.
- **Device-only states** (the native incoming-call screen, CallKit) are the
  web's equivalents.
