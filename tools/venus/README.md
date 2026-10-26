# venus

The generator for Venus's streak stories: one 9:16 video (1080×1920, 30 fps, about 11 to 15 s)
per (day, locale), for days 1–100 plus a second day-1 cut, `return`, for a streak that starts
again after a break. Eight locales, so 101 × 8 = 808 files. Venus is drawn by a 2D vector rig;
every frame is an SVG rasterised by headless Chromium, and ffmpeg makes the mp4.

**One file per (day, locale), shared by everyone.** Nothing in a video depends on the viewer: no
name, no handle, no score. That is a cost decision before it is anything else. A video takes most
of a minute of machine time to render and its line costs ElevenLabs credits to voice, so a per-user cut
would multiply both by the number of people on a streak, every day, for ever. A shared library is
rendered once, voiced once per line and locale, and served from the CDN with a one-year cache. So
nothing is ever rendered or voiced per user, and nothing is added to a video that would need it.

**The lines are number-free.** Each day plays a quip from `data/quips.json` (written by
`node quips.mjs`, the single source of the lines). A line never contains the day's number, so it is
voiced once per locale and the same take serves every day that plays it; the number is on-screen
text, with the app's own `streak.heroUnit` label under it. The takes are made with ElevenLabs, with
the key in `ELEVENLABS_API_KEY` in the environment; nothing in this folder calls the API. The voice
takes and the source art are kept outside the repo. Without a take for a line, `render.mjs` voices
it with macOS `say` as a placeholder, and `batch.mjs` lists every line still waiting for a take in
`voice/needed.json`.

## Before running anything

- macOS (`say` makes the placeholder voices), with `ffmpeg`, `ffprobe` and, for the stickers,
  ImageMagick's `magick` on the `PATH`. Node 24.2 or later: the scripts use `import.meta.main`.
- `pnpm install` at the repo root: the Nunito faces come from the app's
  `@expo-google-fonts/nunito`, the S3 client from `apps/api`.
- Playwright, which this repo does not depend on (see `tools/promo-video/README.md` for why). Set
  `VENUS_PLAYWRIGHT` to an installed `playwright` or `playwright-core` (its `index.mjs`). `CHROME`
  picks the browser binary; without it Playwright launches the Chromium it downloaded.
- The voice takes in `voice/<lang>/<quipId>.wav`, each with an optional ElevenLabs alignment beside
  it as `<quipId>.json`, or `VENUS_VOICE` pointing at a folder laid out the same way.

Everything is run from this folder, and everything it writes goes to `out/`, `work/` and
`cache/`, which git ignores. `VENUS_OUT` moves `out/` somewhere else.

## Rendering

```bash
node render.mjs --day 22 --lang tr                  # out/v1/tr/venus-day022-tr.mp4 + .jpg
node render.mjs --day 1 --lang tr --variant return  # out/v1/tr/venus-day001-return-tr.mp4
node render.mjs --day 22 --lang tr --strip          # a contact strip of every 6th frame, in work/
node render.mjs --day 22 --lang tr --at 2.4,6       # full-size stills, in work/
node render.mjs --day 22 --lang tr --cover          # only the cover

node batch.mjs --from 1 --to 100 --langs tr,en      # parallel; skips what exists
node batch.mjs --from 1 --to 100 --langs tr,en,es,fr,de,ru,ar,pt-BR   # the whole library
```

`render.mjs` takes `--force` to redo a file that exists and `--pages N` (browser pages, default 4).
`batch.mjs` runs one render process per worker (`--workers N`, default a third of the cores),
renders both day-1 cuts whenever day 1 is in the set, can be stopped and run again, and keeps
`out/v1/manifest.json` current after every video. `--library` adds the milestones after day 100
(200 and 365), which are not on the bucket yet.

`grammar.mjs` decides what a day shows (the quip, entrance, reaction, signature move, look, camera,
payoff, music, items) from `data/character.json` and `data/items.json`; it is a pure function of
(day, locale). `node grammar.mjs 1 30 tr` prints the plan.

**Covers.** Every render also writes `venus-dayNNN-<lang>.jpg` beside the mp4 and embeds it in the
mp4 as its cover art. The cover is the film's own frame just before Venus's sign-off slow blink,
when every move has handed her back sitting and facing the lens, with two changes: the number is
at full size rather than the small badge it has shrunk to by then, and the small langx mark sits
where the caption was. So a gallery of covers says which day each one is.

## Publishing

The library lives on the media bucket, beside its manifest:

```
venus/v1/<lang>/venus-dayNNN-<lang>.mp4
venus/v1/<lang>/venus-dayNNN-<lang>.jpg
venus/v1/manifest.json
```

`v1` is immutable. The mp4s and jpgs go up with a one-year `immutable` cache, so a cut that changes
what a day shows is never uploaded over them: it is rendered into, and published as, `v2`.

```bash
node upload.mjs media --dry   # what would go up
node upload.mjs media         # every finished mp4 + jpg pair not already there (same size + md5)
node upload.mjs verify        # the bucket against the local files, size + md5
node upload.mjs manifest      # last: out/v1/manifest.public.json -> venus/v1/manifest.json
```

The manifest goes up last, once `verify` is clean, because it is what tells the app a video
exists. `media` only takes a video whose mp4 and cover have both sat unchanged for three minutes
and whose mp4 probes with a video and an audio stream, so it can run beside a batch;
`./sync-loop.sh` does that every ten minutes until the batch exits.

The storage credentials are `STORAGE_*` from the environment, or else from the repo's `.env` with
`.env.prod` laid over it, read inside the process only.

## Stickers

```bash
node sticker-pack.mjs              # out/stickers/pack/: the chat sticker pack
node sticker-pack.mjs --only hi,ok # just those
node stickers.mjs                  # out/stickers/: 12 die-cut stickers and a sheet
```

The pack is 512 px transparent die-cut PNGs in `out/stickers/pack/png/` and `stickers.json` beside
them (file, id, the in-app id, emoji, keywords): 18 text-free poses, four English word stickers and
"Hello" in each of the app's eight languages. It is drawn with the pack's own copy of the rig,
`rig/venus-rig-pack.js`, which can place a raised paw exactly.

## Checks

```bash
node --test test/*.test.mjs   # grammar, items, character rules, day-1 cuts, the acting vocabulary
node lint-quips.mjs           # the character lint on every line in every locale
```

The bible check in `test/items.test.mjs` needs `VENUS_BIBLE`, the character bible, which is kept
outside the repo; without it the test is skipped.

## What is where

| Path                                 | What                                                                         |
| ------------------------------------ | ---------------------------------------------------------------------------- |
| `render.mjs`, `batch.mjs`            | One video; many in parallel, with the manifest                               |
| `grammar.mjs`                        | The plan for a (day, locale)                                                 |
| `lib/score.mjs`, `lib/intro.mjs`     | The acting, timed from the measured voice; the two day-1 cuts                |
| `lib/layers.mjs`, `lib/endcard.mjs`  | Grounds, the number, the caption bubble, effects; the end card               |
| `lib/items.mjs`, `lib/items-art.mjs` | Her props: the per-day picks and their drawings (`items-build.mjs`)          |
| `lib/voice.mjs`, `lib/audio.mjs`     | Takes and placeholders; voice analysis, SFX, music and the mix               |
| `lib/synth/`                         | The offline audio kit: DSP, synthesised SFX and music beds, `say`, the mix   |
| `rig/`                               | The polished 2D vector rig and its animator                                  |
| `data/`                              | Lines, character rules, items, end-card slogans, the streak label            |
| `assets/`                            | Item SVGs (generated), the brand mark and wordmark, the Arabic end-card face |
| `quips.mjs`, `lint-quips.mjs`        | The lines' source; the character lint                                        |
| `upload.mjs`, `sync-loop.sh`         | Publishing to the bucket                                                     |
| `sticker-pack.mjs`, `stickers.mjs`   | Stickers, with the die-cut in `lib/diecut.mjs`                               |
| `inventory.md`                       | Every item, generated by `node items-build.mjs --doc`                        |
| `out/`, `work/`, `cache/`, `voice/`  | Not committed                                                                |

| Variable           | Default               |                                                           |
| ------------------ | --------------------- | --------------------------------------------------------- |
| `VENUS_OUT`        | `out/`                | where renders go; the library is `$VENUS_OUT/v1/`         |
| `VENUS_VOICE`      | `voice/`              | the voice takes                                           |
| `VENUS_PLAYWRIGHT` | `playwright`          | the module to import; an absolute path works              |
| `CHROME`           | Playwright's Chromium | the browser binary                                        |
| `VENUS_END`        | `splash`              | the end card: `splash`, `handoff`, `sticker`, `legacy`    |
| `VENUS_SLOGAN`     | the recommended one   | the end-card slogan, a key in `data/endcard-slogans.json` |
| `VENUS_BIBLE`      | unset                 | the character bible, for the one test that reads it       |
