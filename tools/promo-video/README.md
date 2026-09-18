# promo-video

Cuts a 1080x1920 vertical promo video out of the real app: a scripted run
through Discover, a profile, a first message and the reply that comes back,
framed on a brand ground with a hook, captions, an end card and a music bed.

Both sides are real. The partner's reply is typed by a second signed-in
session in a browser nobody records, through the same guards as anybody
else's message — a reply written straight into the database would be a picture
of the app rather than the app.

Nothing here is hand-timed. `capture.mjs` writes down when each step actually
happened; `compose.mjs` computes every caption window and every trim point from
those numbers — so a run where the app was slower produces a correct cut rather
than captions that have slipped.

It also uses them to cut the dead time out: the seconds a screen spends on its
skeleton, and the minute the partner's session takes to sign in and answer. Each
becomes a short dissolve. Nothing a viewer watches the app do is sped up — the
cuts are where nothing is happening at all, and `compose.mjs` prints how many
seconds it removed.

## Before you run it

Four things, in this order.

```bash
# 1. the API, on :4000
cd apps/api && pnpm dev

# 2. the web build, served on :8081
#    An export, not Metro: the dev bundle compiles on the first frames and
#    drops frames on every scroll, and Metro hits EMFILE inside a worktree.
pnpm -C apps/mobile build:web
node tools/promo-video/serve.mjs

# 3. the cast (once per database)
cd apps/api && pnpm exec tsx --env-file=../../.env scripts/seed-test-users.ts --db langx_dev

# 4. playwright, which this repo does not depend on — a browser download in
#    everyone's `pnpm install` for a script that runs when a video is cut is
#    the wrong trade. Install it however you like and point the capture at it.
npm i -g playwright     # or set PROMO_PLAYWRIGHT to an existing one
```

`apps/mobile/.env` must point `EXPO_PUBLIC_API_URL` at `http://localhost:4000`.
If it still says `api.langx.io` the capture records **production**, which means
real people's profiles in an advert. `capture.mjs` refuses a non-localhost API,
but it can only check the one it signs in against, not the one the app calls.

## Cutting a video

```bash
# The thread the video scrolls through, and the boosts that fill the strip
# above it. Rebuilds from scratch every time, which is what makes the capture
# repeatable: the run ends by sending a real message, and without this the
# next one would open on the last one's.
cd apps/api && pnpm exec tsx --env-file=../../.env \
  scripts/seed-promo-chat.ts --db langx_dev

# The end card (lives in apps/api because satori and the fonts do)
cd apps/api && pnpm exec tsx scripts/render-promo-endcard.ts \
  --out ../../tools/promo-video/out/endcard.png

PROMO_PLAYWRIGHT=/path/to/playwright/index.js node tools/promo-video/capture.mjs
node tools/promo-video/compose.mjs en
node tools/promo-video/verify.mjs en
```

Then **open `out/frames/contact.png` and look at it**. The checks catch a
recording that lost half its resolution or opened on a blank frame; they cannot
catch a toast that walked into shot, a caption clipped by its band, or a screen
that spent three seconds on its skeleton.

Output is `out/langx-promo-en.mp4`. Everything under `out/` is build output and
is not committed — the finished files belong in the branding checkout, beside
the store screenshots.

## Knobs

| Variable                         | Default                           |                                             |
| -------------------------------- | --------------------------------- | ------------------------------------------- |
| `PROMO_PLAYWRIGHT`               | `playwright`                      | module to import; an absolute path works    |
| `PROMO_CHANNEL`                  | `chrome`                          | `chromium` uses Playwright's own build      |
| `PROMO_PARTNER`                  | `Katya`                           | display name the capture clicks in Discover |
| `PROMO_PARTNER_HANDLE`           | `test_katya`                      | the same person, for warming and signing in |
| `PROMO_VIEWER_NAME`              | `George`                          | the row the partner clicks in their chats   |
| `PROMO_MUSIC`                    | _(synthesised)_                   | a real track to use instead of the bed      |
| `PROMO_EMAIL` / `PROMO_PASSWORD` | `test_george@…` / `TestUser!2026` | who is browsing                             |
| `PROMO_WEB` / `PROMO_API`        | `:8081` / `:4000`                 | the stack                                   |

Copy — the hook, the captions, the message that gets typed — is in
`captions.json`, keyed by locale. Changing a hook needs no new recording: the
same `journey.webm` composes again in a couple of seconds.

## Things that will bite

**Gray down one side of the phone.** Chromium's screencast hands over
CSS-sized frames, so a 400-wide viewport arrives 400 wide however high the
context's `deviceScaleFactor` is, and Playwright pads the rest of the size it
was asked for with flat gray. `--force-device-scale-factor=2` at launch is what
actually moves the frames to 800. `verify.mjs` fails on the padding.

**No emoji, anywhere.** `drawtext` refuses a colour emoji font outright, and an
emoji inside Nunito draws a silent white box. satori has the same gap, so the
end card cannot rescue one either. Type only.

**Captions go in through `textfile=`.** A colon inside `text=` breaks the
filter graph even quoted; an apostrophe is worse. `compose.mjs` writes each
line to its own file, so copy can contain whatever it likes.

**`concat` wants identical size, rate and SAR**, hence `setsar=1` and `fps=25`
on both branches. Playwright records at a hard 25 fps; converting to 30
duplicates every fifth frame and shows as judder on exactly the slow scroll
this pipeline works to get right.

**There is no video message in the chat, deliberately.** The thread has a
voice note (spoken by `say`, transcoded to AAC) and a picture (drawn by satori,
which is why it is a drawing and not a photograph — a photograph would have to
come from somewhere, and a stock one under an advert is a licence question).
A video would need footage nobody has licensed either, and a video playing
inside a video of a phone reads as neither.

**Media unlocks after five messages from the other person.** That is a real
rule (`assertMediaUnlocked`), not a fixture detail: move the voice note or the
picture earlier in `seed-promo-chat.ts`'s script and the seed stops with
MEDIA_LOCKED, correctly.

**The cut is silent, and should stay that way here.** Add the music in
Instagram's or TikTok's own editor at upload, from their licensed libraries:
that is the only music that cannot get the post muted, and both platforms
favour posts using it. A public repository cannot carry somebody else's track
either.

`music.mjs` can synthesise a bed in three styles (`warm`, `lofi`, `pulse`) and
`PROMO_MUSIC_STYLE` lays one under the cut, but sine waves do not sound like
music under an advert — it is there to hear a cut's pacing, not to ship. For a
real file, `PROMO_MUSIC=/path/to/track.mp3`.

**Selectors are text.** There are no testIDs in the app, so a copy change in
`src/i18n/messages/en.ts` breaks the capture. It fails loudly rather than
recording a broken run.
