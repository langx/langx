/**
 * The one thing every tool that writes a pack has to agree about: its shape.
 *
 * Four things write `content/echo/<lang>/<level>.json` — `build-pack.mjs`
 * drafts it, `add-audio.mjs` adds a recording, `images/build.mjs` sets the
 * cues and `tts/generate.py` the readings — and for a year they disagreed
 * about how to print it, in a way nothing caught.
 *
 * **Prettier's JSON printer defaults to `objectWrap: "preserve"`.** An object
 * with a line break after its `{` keeps its expanded shape; one without gets
 * wrapped to `printWidth`. So `JSON.stringify(pack, null, 2)` and
 * `prettier.format(JSON.stringify(pack))` produce different files and *both*
 * pass `format:check` — prettier is being asked to preserve two different
 * intentions and is doing exactly that. The packs then flipped between the
 * two shapes depending on which tool ran last, and a run that changed one
 * cue arrived as a four-thousand-line diff with one line of content in it.
 * The reviewer's only way to tell the difference was to parse both sides.
 *
 * So the shape is decided once, here, rather than assumed in four places.
 * Prettier's own wrapping is the one worth keeping: it is what `pnpm format`
 * would converge on if `objectWrap` were `collapse`, and it puts a short
 * `voices` entry on one line where the expanded form spends four.
 *
 * `tts/generate.py` cannot import this. It holds the same two lines with a
 * comment pointing here, the way `voice_key` there mirrors `packVoiceKey` in
 * `packages/shared`.
 */
import { writeFile } from 'node:fs/promises'
import prettier from 'prettier'

/**
 * Writes `pack` to `path` in the shape every other tool writes.
 *
 * `JSON.stringify` with no indent, then prettier: the single line is what
 * leaves prettier free to wrap, and the resolved config is what decides where.
 */
export async function writePack(path, pack) {
  const config = await prettier.resolveConfig(path)
  await writeFile(path, await prettier.format(JSON.stringify(pack), { ...config, filepath: path }))
}
