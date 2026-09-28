# showreel

A motion-design reel for LangX: one self-contained page that plays like a
video — a 1920x1080 stage scaled to fit, a synthesized score, a scrubber — and
ends on the logo lockup, which is also the frame it rests on. The same page
renders frame by frame to an MP4.

It is not the app's launch screen. That one is `AppSplash.tsx` and it has about
a second to live; this is the long version, for the website, a store listing, a
talk or a reel.

## Looking at it

Open `src/index.html` in a browser. It autoplays muted; the button in the top
corner turns the sound on, and the bar at the bottom scrubs.

| Key         | Does                  |
| ----------- | --------------------- |
| Space / K   | play, pause           |
| ← / → (J/L) | previous / next scene |
| M           | sound on, off         |
| R           | from the top          |

With `prefers-reduced-motion` set it opens on the lockup and plays only when
asked.

Query parameters, for working on it: `?scene=03-hello` loops one scene,
`?t=12.5` starts at a time, `?tc` burns in a timecode, `?capture` hides the
player and waits to be seeked.

## Tools

Playwright is not a dependency of this repo (see `tools/promo-video/README.md`
for why); point `REEL_PLAYWRIGHT` at an installed copy's `index.js`. The
browser is the system Chrome.

```bash
# a contact sheet of one scene: 16 frames, timecode burnt in
node tools/showreel/snap.mjs --scene 03-hello

# any window, any density; or exact times at full size
node tools/showreel/snap.mjs --from 10 --to 14 --n 12
node tools/showreel/snap.mjs --times 0,4.5,9.99 --full

# the last and first frame of every cut, side by side
node tools/showreel/snap.mjs --boundaries

# one file with everything inlined: dist/langx-reel.html
node tools/showreel/build.mjs

# the MP4, seeked frame by frame, with the score rendered offline
node tools/showreel/render.mjs --fps 60
```

Everything they write goes to `out/`, which git ignores.

## How it is built

`src/core.js` owns one master GSAP timeline and the scene plan: every scene's
start, length and ground, in beats at 120 BPM. Each file in `src/scenes/`
registers a builder:

```js
REEL.scene('03-hello', (ctx) => {
  const { tl, b, E, C } = ctx
  const word = ctx.el('div', {
    text: ctx.GL.tr.text,
    style: { font: `900 220px ${ctx.F.display}` },
  })
  tl.from(word, { yPercent: 110, duration: b(1), ease: E.snap }, b(0))
  ctx.cue(b(0), 'kick')
})
```

The builder fills `ctx.tl`, a child timeline the master places at the scene's
start, so every position in it is local to the scene. The core owns the plan,
not the scene files, so no builder can move a boundary its neighbour is cutting
against.

### The context

| Member                            | What                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| `root`                            | the scene's 1920x1080 layer; everything goes in here                                        |
| `tl`                              | the scene's timeline, local time 0 = scene start                                            |
| `dur`, `beats`                    | the slot, in seconds and in beats; the timeline must not run past it                        |
| `b(n)`, `bar(n)`                  | beats and bars to seconds (120 BPM: a beat is 0.5s, a bar 2s)                               |
| `C`, `F`, `E`                     | palette, font stacks, the style bible's named eases                                         |
| `G`, `GL`, `T`, `TL`              | greetings and thank-yous (list, and by language code) with the font each script needs       |
| `el(tag, props, parent?)`         | an HTML element; `props` takes `class`, `style` (object or string), `text`, `html`, `attrs` |
| `svgLayer(parent?)`               | a full-stage `<svg>` in stage pixels                                                        |
| `svg(tag, attrs, parent)`         | an SVG element                                                                              |
| `mark(svgParent, {x, y, size})`   | the logo mark, live: `{ g, black, white, blackShadow, whiteShadow, shadows }`               |
| `MARK`                            | its construction: centres, radii, angles, the shadow offset, the two path strings           |
| `arcPath(cx, cy, ro, ri, a0, a1)` | a filled annular sector — with `MARK`'s numbers, one of the arcs; a morph target            |
| `arcStroke(cx, cy, r, a0, a1)`    | an arc's centre line, for a butt-capped stroke DrawSVG can draw                             |
| `split(el, vars)`                 | `SplitText.create`, with fonts already loaded                                               |
| `canvas()`                        | a stage-sized canvas `{ el, g, k, clear() }`; call `clear()` first in every draw            |
| `draw(fn)`                        | `fn(localTime)` runs on every rendered frame while the scene is visible                     |
| `cue(t, name, opts?)`             | a sound at local time `t` — see the vocabulary in `audio.js`                                |
| `ground(color, t, d?, ease?)`     | change the scene's ground and the letterbox at `t`, over `d` seconds                        |
| `letterbox(color, from, to)`      | hold the bars around the stage at `color` over local [from, to), whatever the ground is     |
| `rng(seed)`                       | a seeded random source; never `Math.random()`                                               |

`mark()`'s group is centred on `(x, y)` with GSAP's `svgOrigin` at the mark's
middle, so `x`, `y`, `scale` and `rotation` on `g` move the whole mark. To turn
one arc on its own centre, tween it with its shadow:
`tl.to([m.black, m.blackShadow], { rotation: 90, svgOrigin: '591 463.5' })`
(the white arc's centre is `'433 560.5'`). The shadows' parent carries the
offset, so the shadow stays down and to the right whichever way an arc turns.

### Rules the format imposes

- **A pure function of the playhead.** The page is scrubbed, played live and
  rendered by seeking, so anything with its own clock breaks one of the three:
  no CSS animations or transitions, no `Math.random()`, no stepped physics, no
  tweens outside `ctx.tl`, no `tl.call` doing visual work. Canvas work reads the
  time it is given, or objects the timeline tweens.
- **Shaped scripts move whole.** Arabic, Devanagari, Thai and Hebrew carry
  `split: false`: cut into letters they lose their joins and conjuncts. Move
  the word, or reveal it behind a mask.
- **No blur, no filters.** The brand has none, and a filter on a large layer is
  where a laptop drops frames.
- **The arcs are black and white.** Only the ground changes.
