// Where things live. Everything the generator reads is in tools/venus/; what it writes goes to
// out/, work/ and cache/ beside it, and the voice takes are read from voice/. All four are
// gitignored. VENUS_OUT and VENUS_VOICE point the output and the voice takes somewhere else.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
export const GEN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// the checkout this folder is in: the app's catalogues and fonts, and the API's S3 client
export const REPO = path.resolve(GEN, '../..')
// style 1 · cilalı (polished), the 2D vector rig
export const RIG = path.join(GEN, 'rig')
const dirFromEnv = (name, fallback) =>
  process.env[name] ? path.resolve(process.env[name]) : fallback
// everything rendered: the library under v1/, plus the stickers and the item catalogues
export const OUT_ROOT = dirFromEnv('VENUS_OUT', path.join(GEN, 'out'))
// the library is versioned like the bucket path (media.langx.io/venus/v1/<lang>/...): a re-cut that
// changes what a day shows goes to v2 rather than overwriting files apps may have cached as immutable
export const OUT = path.join(OUT_ROOT, 'v1')
export const WORK = path.join(GEN, 'work')
export const CACHE = path.join(GEN, 'cache')
// <lang>/<quipId>.wav (+ .json alignment): see lib/voice.mjs
export const VOICE_DIR = dirFromEnv('VENUS_VOICE', path.join(GEN, 'voice'))
