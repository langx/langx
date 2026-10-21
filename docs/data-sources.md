# Third-party data

Data the app carries that we did not produce. Code dependencies are in the
lockfile; this is the list of _data_, which has its own licences and its own
attribution obligations.

## Cities — GeoNames

`cities` holds every place with a population over fifteen thousand — about
thirty-two thousand rows once the seed drops what nobody calls home: the
export also lists neighbourhoods (`PPLX`, a "section of populated place") and
historical, abandoned or destroyed places, and a Toronto waterfront district
outranking Toronto is what happens when they are left in. A profile's city is
read off its stored coordinates against this list, and the discovery filter
searches the same list, so the two ends of that filter cannot disagree.

|             |                                                             |
| ----------- | ----------------------------------------------------------- |
| Source      | <https://download.geonames.org/export/dump/cities15000.zip> |
| Licence     | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)   |
| Seeded by   | `apps/api/scripts/seed-cities.ts`                           |
| Credited in | this file, `README.md`, and the app's "Our Kitchen" screen  |

The required notice, which must appear wherever the data is credited:

> This work is based on data from GeoNames (<https://www.geonames.org/>),
> licensed under CC BY 4.0.

Refreshing it is a re-run of the seed script against a newly downloaded export;
every row is upserted by its own id, so ids are stable across updates and a
profile's `cityId` survives. A row the export no longer carries — or one the
seed now skips — is deleted, and every profile that pointed at it has its city
worked out again from its stored coordinates, so a city never outlives the
list it came from.

**Attribution is a licence condition, not a courtesy.** Removing it from any of
the three places above is a licence breach, and the repo is public.

## Stickers — all ours

Each sticker pack is twelve flat SVGs, and since the v3 redraw every one of
them was drawn for this app and carries no licence but ours. Until then half of
`starter` and half of `practice` were Microsoft's Fluent Emoji (MIT); the
redraw replaced those files under the same ids, so the notice that travelled
with them went with them.

`pixel` is generated from `tools/pixel-stickers/build-stickers.mjs`, where each
sticker is a grid of characters rather than a path. Edit the grid and re-run
it; the SVGs are committed output. Every other pack was drawn on the v3 store's
design boards, and the SVGs are the source.

|         |                                                   |
| ------- | ------------------------------------------------- |
| Licence | ours; lettering outlined from Nunito / Noto (OFL) |

Some packs carry words — "¡Hola!" on a speech bubble, "안녕" on a stamp. The
words are glyph outlines converted to paths, never SVG `<text>`, so the files
hold no font and no device needs one installed. The SIL Open Font License,
which covers Nunito (see `apps/api/assets/fonts/`) and Noto, allows glyph
outlines in artwork. To change a word, redraw it on the board and outline it
again rather than editing the path data; a script with an Arabic or Devanagari
word must be shaped (HarfBuzz) before it is outlined, or its letters do not
join. The words on a picture are never the only way to know what it says:
every sticker has a translated screen-reader name (`stickerName.*` in the
app's messages).

Three rules every file follows, all of which outlive this particular art. The
first two are checked by `apps/mobile/src/lib/stickerAssets.test.ts`:

**No filters, no gradients, no arcs.** `expo-image` decodes SVG through
`androidsvg` on Android, which supports neither filters nor gradients, and
draws arc commands (`A` in a path) wrongly on iOS. Anything richer draws in a
browser and silently flattens or vanishes on a phone. Round shapes are
`<circle>` and `<ellipse>`; curves are `C` and `Q`.

**Twelve kilobytes at most.** A sticker is drawn in every chat that sends one.

**A skin tone is a choice we are not making.** Picking one default for a
global language exchange is a decision with no right answer, so the hands we
draw are white with an ink outline, which reads as a glyph rather than as
anybody's skin.
