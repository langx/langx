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

**Room under the number.** The stage under the number is laid out for Venus's own height, ears
included. When what she wears or sits on reaches higher (day 30's party hat, day 50's balloon, a
cushion she sits up on), `render.mjs` draws her smaller about the ground line, just enough to keep
it all under the label on the cover and through the film, and logs the scale. Every other day
renders exactly as before.

## The introduction film

`film.mjs` makes "Venus: Starring Herself", the film behind the Venus page's "Watch the
introduction": one cut per locale, 1080×1920, 30 fps, about 109 s in English and up to about 113 s
in the longest locale (de). Like the days it is shared, one file per locale. It is not in the
manifest: `node upload.mjs intro` puts each locale's mp4 and cover beside the days, as
`venus/v1/<lang>/venus-intro-<lang>.mp4`. The app plays a smaller copy of it, made by hand (below).

The app plays `venus-intro-<lang>-r3.mp4`, not the master: the same cut re-encoded for phones on
mobile data, about 24 MB instead of about 50, with the picture size and the audio unchanged
(SSIM 0.997 against the master), and its cover copied under the same name. A suffix rather than
a replacement because `v1` is cached for a year and nothing there is overwritten:

```bash
ffmpeg -i venus-intro-<lang>.mp4 -c:v libx264 -preset slow -profile:v high -level:v 4.1 \
  -b:v 1700k -maxrate 2200k -bufsize 4000k -pix_fmt yuv420p -c:a copy -movflags +faststart \
  venus-intro-<lang>-r3.mp4
```

Keep `-level:v 4.1`, the level of the master and the days. Without it, `-preset slow` uses five
reference frames, which at 1080×1920 makes the stream level 5.0, and a phone's decoder may refuse
a level it does not list. That is why `-r2`, the first copy, is in the bucket and unused.

```bash
node film.mjs --lang tr                  # $VENUS_OUT/intro/tr/venus-intro-tr.mp4, .jpg, .vtt, -preview.mp4
node film.mjs --lang tr --at 12.4,64     # full-size stills at those board times, in work/
node film.mjs --lang tr --strip 15       # a contact sheet of every 15th frame, in work/
node film.mjs --lang tr --sheets <dir>   # with the render: a frame every 0.5 s, and the key beats
node film.mjs --all --jobs 3             # every locale, one process each
node film.mjs --script voice-script.json # every line, its text and its characters per locale
```

The cover (`.jpg`, also the mp4's cover art) is the title card. The preview is 720×1280 and under
8 MB, for review. Until the lines are voiced the cut has music and sound effects only, with every
line burned in as a subtitle and in the `.vtt`; the film never voices a line itself, not even with
`say`. The `.vtt` holds back what the bubble holds back: a sentence after a "…", and each "Bag." of
the bag run, starts a cue of its own when it appears, so the caption file never pre-reads a
punchline. Each section's music is a loop at a fixed tempo laid from its first beat; wherever
there is no music (the cold open, the empty set, the breath before day 100, the bonk) a faint room
tone sits under the sound effects instead, so a silent cut never plays its captions over a dropout.

**The board and the clock.** `data/film-intro.json` holds the 22 lines in the eight locales and
every sentence's time on the English silent cut (the board). `lib/film-clock.mjs` turns it into a
locale's clock: a sentence that runs longer than its board time, at 14 characters a second or as
its take is said, pushes everything after it later, by whole beats inside the 120 bpm sections so
cuts stay on the music; a shorter one pushes nothing. Every cut, move, sound and caption is a board
time mapped through that clock, so voicing the film is dropping the takes in and rendering again:
`voice/<lang>/intro-NN.wav` with its ElevenLabs alignment as `intro-NN.json` (or under
`VENUS_VOICE`). The lines keep their sentence count and every "…" in every locale, because beats
land on sentences by position; `en` and `tr` are final, the other six want a native read.

**The shots.** `lib/film-shots.mjs` is what Venus does, written with the days' own vocabulary
(`lib/score.mjs` entrances, reactions and moves, the rig, `lib/items.mjs`). The race through the
days is the days themselves, drawn by `render.mjs` with her mouth shut. A one-second window opens on
its day already settled (its number popping on the cut, its seat, outfit and items on); the three
half-second bag days open with the bag already under her, so each "Bag." lands with its bag, and day
93's kraft bag lands on "…Different bag."; day 100 opens on the frame its slammed number hits, with
the music's return, the thud and the shake. Every window, like every shot with a counter, draws her
just small enough that her ears stay under the number's label (measured in the browser, as
`fitUnderLabel` measures a day); on the bag days, and in the bag-hop entrance that plants the gag,
the camera also pulls back and up (`BAG_CAM`), and in the comeback it rises while the bag is the
joke, so the bag clears the caption. In the bonk her leap's last frame meets the
locked day's bottom edge and she stays pressed to it, turning to the lens and scrabbling, until
she drops in the last 0.3 s (the heights are measured, not guessed). The photo-booth print lands as
a big blep sticker above her for "It's a sticker now.", and only takes its place in the ring as the
slaps begin. On the title card a two-line tagline (de, es, fr, pt-BR, ru) lowers the stage under it,
so the pill clears her ears on the cover. The wall is made of the
published covers, read from the CDN once into `cache/intro-covers/`. `lib/film-layers.mjs` draws
what only the film has (the title, pills, the clapper, the photo print, stickers, the wall tiles),
and `lib/endcard.mjs` closes it (`--end handoff`, the default, or `splash`).

**Red lines the tests hold.** `test/film.test.mjs` performs every shot in every locale without a
browser and checks the timing (the English clock is the board, takes re-time it, pushes stay on the
beat), the lines (sentence shape, no digits, the character lint) and the screen: one caption at a
time, a sentence after a "…" on a line of its own, never clearing within a quarter second of a cut
(a bubble that clears on a cut is gone on its frame), a dash or a lone "?" never starting a line, a
little word ("по", "a") left at a line's end only when no smaller size avoids it, no gap between a
line's WebVTT cues, the co-star (the viewer) in the generic form in es and pt-BR, no
face she never aims at the viewer, and
flashes at least 0.5 s apart with at most three flashes or cuts in any second. Each flash washes at
most 20% white.

## Publishing

The library lives on the media bucket, beside its manifest:

```
venus/v1/<lang>/venus-dayNNN-<lang>.mp4
venus/v1/<lang>/venus-dayNNN-<lang>.jpg
venus/v1/manifest.json
```

`v1` is immutable. The mp4s and jpgs go up with a one-year `immutable` cache, so a cut that changes
what a day shows is never uploaded over them: it is rendered into, and published as, `v2`. A
single re-cut can also go up beside the original under a new name, `venus-day030-en-r2.mp4` and
its `.jpg`; `media` takes those too. The app still plays the plain name it builds for the day
(`apps/mobile/src/lib/venusStory.ts`) and only when the manifest lists that name, so a re-cut
reaches the links that name it, not the app.

```bash
node upload.mjs media --dry   # what would go up
node upload.mjs media         # every finished mp4 + jpg pair not already there (same size + md5)
node upload.mjs verify        # the bucket against the local files, size + md5
node upload.mjs manifest      # last: out/v1/manifest.public.json -> venus/v1/manifest.json
node upload.mjs intro --dry   # the film: every locale's venus-intro mp4 + jpg from $VENUS_OUT/intro/
node upload.mjs intro         # all of them, or nothing if a venus-intro object is already there
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
node --test test/*.test.mjs   # grammar, items, character rules, day-1 cuts, the acting vocabulary, the film
node lint-quips.mjs           # the character lint on every line in every locale, the film's too
```

The bible check in `test/items.test.mjs` needs `VENUS_BIBLE`, the character bible, which is kept
outside the repo; without it the test is skipped.

## What is where

| Path                                 | What                                                                          |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| `render.mjs`, `batch.mjs`            | One video; many in parallel, with the manifest                                |
| `grammar.mjs`                        | The plan for a (day, locale)                                                  |
| `lib/score.mjs`, `lib/intro.mjs`     | The acting, timed from the measured voice; the two day-1 cuts                 |
| `lib/layers.mjs`, `lib/endcard.mjs`  | Grounds, the number, the caption bubble, effects; the end card                |
| `lib/items.mjs`, `lib/items-art.mjs` | Her props: the per-day picks and their drawings (`items-build.mjs`)           |
| `lib/voice.mjs`, `lib/audio.mjs`     | Takes and placeholders; voice analysis, SFX, music and the mix                |
| `lib/synth/`                         | The offline audio kit: DSP, synthesised SFX and music beds, `say`, the mix    |
| `rig/`                               | The polished 2D vector rig and its animator                                   |
| `data/`                              | Lines, character rules, items, end-card slogans, the streak label             |
| `assets/`                            | Item SVGs (generated), the brand mark and wordmark, the Arabic end-card face  |
| `quips.mjs`, `lint-quips.mjs`        | The lines' source; the character lint                                         |
| `upload.mjs`, `sync-loop.sh`         | Publishing to the bucket                                                      |
| `film.mjs`, `lib/film-*.mjs`         | The introduction film: its clock, shots and drawings (`data/film-intro.json`) |
| `sticker-pack.mjs`, `stickers.mjs`   | Stickers, with the die-cut in `lib/diecut.mjs`                                |
| `inventory.md`                       | Every item, generated by `node items-build.mjs --doc`                         |
| `out/`, `work/`, `cache/`, `voice/`  | Not committed                                                                 |

| Variable           | Default               |                                                           |
| ------------------ | --------------------- | --------------------------------------------------------- |
| `VENUS_OUT`        | `out/`                | where renders go; the library is `$VENUS_OUT/v1/`         |
| `VENUS_VOICE`      | `voice/`              | the voice takes                                           |
| `VENUS_PLAYWRIGHT` | `playwright`          | the module to import; an absolute path works              |
| `CHROME`           | Playwright's Chromium | the browser binary                                        |
| `VENUS_END`        | `splash`              | the end card: `splash`, `handoff`, `sticker`, `legacy`    |
| `VENUS_SLOGAN`     | the recommended one   | the end-card slogan, a key in `data/endcard-slogans.json` |
| `VENUS_BIBLE`      | unset                 | the character bible, for the one test that reads it       |
