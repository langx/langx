# store-shots

The App Store and Google Play screenshots for app 3.0, from the real app:
seeded demo data, captured screens, composed into store tiles at every size
each store takes. One command does all of it; nothing is uploaded anywhere.

```bash
pnpm install                                   # in this checkout — never borrow another's node_modules
node tools/store-shots/run.mjs --out ../store-shots-3.0
node tools/store-shots/run.mjs --out ../store-shots-3.0 --locales en      # one locale
node tools/store-shots/run.mjs --out ../store-shots-3.0 --reuse-web       # skip the web export
node tools/store-shots/run.mjs --out ../store-shots-3.0 --skip-capture    # recompose only
```

Needs Google Chrome (`SHOTS_CHROME` to point elsewhere) and about ten minutes
for all eight locales. Then **open `<out>/<locale>/contact.html` and look at
every tile** — the checks catch a wrong size, not a toast in frame.

## What it does

| Step    | File               | What                                                                                                                       |
| ------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| export  | `stack.mjs`        | `expo export --platform web` of this checkout, pointed at the stack's API                                                  |
| stack   | `stack.mjs`        | in-memory replica set + this checkout's API on its own ports, in a clean environment (no mail, push, store or cloud DB)    |
| seed    | `seed.mts`         | @sofia's world through the module functions: threads, corrections, Echo cards, a 34-day streak, a balance, badges          |
| capture | `capture.mjs`      | headless Chrome over CDP, 440×894 pt at 3× (the 6.9″ width, minus the status bar), light mode, per locale                  |
| compose | `compose.mjs`      | each tile an HTML page photographed at the slot's exact size; hue ground, caption, ink bezel, drawn status bar             |
| check   | `run.mjs`          | every file's size, PNG without alpha, count per slot; `manifest.json`; a contact sheet per locale                          |
| words   | `shots.config.mjs` | order, grounds, capture recipes, captions in eight locales, slots — the only file to edit for a change of order or wording |

Ports are 27170 (mongo), 4870 (API), 8870 (web), 9370–9372 (Chrome);
`SHOTS_MONGO_PORT`, `SHOTS_API_PORT` and `SHOTS_WEB_PORT` move them. The run
refuses to start if any is taken, and never uses :4000. Everything it starts
it stops through its own handles.

The demo viewer is **Sofia (@sofia)**. Her partners are fixture accounts
(`demo_*` handles on `test.langx.invalid`) whose ids are drawn so each keeps
the board's hue: Anna lilac, George tangerine, Yuki mint.

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
  …/alt/09-no-prices.png                   shot 9 with the plans cut off
```

Numbers are store order, zero-padded so a plain sort is the order. Play skips
`home`, so Play's 06 is `store`. Shot 9 comes twice: `09.png` as captured and
`alt/09-no-prices.png` with the phone lowered until the plan cards run off the
tile — whether a store picture shows a price is an open call.

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

- **No store prices.** The web paywall says purchasing is not set up there, so
  `09.png` from a web capture is a placeholder. A priced shot 9 has to come
  from an iOS Release build with a StoreKit configuration (US storefront).
- **No real status bar.** The composer draws one (9:41, full battery), iOS or
  Android shapes by slot.
- **Device-only states** (the native incoming-call screen, CallKit) are the
  web's equivalents.
