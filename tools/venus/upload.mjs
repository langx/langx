// Upload the rendered library to the bucket under venus/v1/.
//
//   node upload.mjs media      every mp4 + jpg in out/v1/<lang>/ (skips objects already there, same size + md5)
//   node upload.mjs manifest   writes out/v1/manifest.public.json and uploads it as venus/v1/manifest.json
//   node upload.mjs verify     lists venus/v1/ in the bucket and compares it with the local pairs (size + md5)
//   node upload.mjs intro      the introduction film (film.mjs): every locale's mp4 + jpg in out/intro/<lang>/
//                              to venus/v1/<lang>/, and nothing at all if any venus-intro object is already there
//   add --dry to list what would go up without uploading
//
// The library is read from VENUS_OUT/v1 when VENUS_OUT is set (lib/paths.mjs).
//
// Credentials: STORAGE_* from the environment, or else from the repo's .env with .env.prod laid
// over it, read inside this process only. Nothing here prints, logs or writes them.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { REPO, OUT, OUT_ROOT } from './lib/paths.mjs'

const V1 = OUT
const PREFIX = 'venus/v1'
// What this run is, decided once from the command line and switched on at the bottom; a failure sets
// the exit code rather than exiting, so no condition on the command line ends the process (as in
// film.mjs)
const mode = ['media', 'manifest', 'verify', 'intro'].find((m) => m === process.argv[2]) ?? 'usage',
  dry = process.argv.includes('--dry')

const readEnv = (f) => {
  const o = {}
  if (!fs.existsSync(f)) return o
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*(STORAGE_[A-Z_]+)\s*=\s*(.*)\s*$/)
    if (m) o[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
  }
  return o
}
const fromProcess = Object.fromEntries(
  Object.entries(process.env).filter(([k]) => k.startsWith('STORAGE_')),
)
const env = {
  ...readEnv(path.join(REPO, '.env')),
  ...readEnv(path.join(REPO, '.env.prod')),
  ...fromProcess,
}
const unset = [
  'STORAGE_ENDPOINT',
  'STORAGE_BUCKET',
  'STORAGE_ACCESS_KEY_ID',
  'STORAGE_SECRET_ACCESS_KEY',
].filter((k) => !env[k])

const req = createRequire(path.join(REPO, 'apps/api/package.json'))
const { S3Client, PutObjectCommand, HeadObjectCommand, ListObjectsV2Command } =
  req('@aws-sdk/client-s3')
const s3 = new S3Client({
  endpoint: env.STORAGE_ENDPOINT,
  region: env.STORAGE_REGION || 'auto',
  credentials: {
    accessKeyId: env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
  },
})
const Bucket = env.STORAGE_BUCKET

const TYPES = { '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.json': 'application/json' }
// v1 is a versioned path: a changed cut goes to v2, so the media can be cached for good
const CACHE = {
  '.mp4': 'public, max-age=31536000, immutable',
  '.jpg': 'public, max-age=31536000, immutable',
  '.json': 'public, max-age=300',
}

async function put(local, key) {
  const ext = path.extname(local),
    body = fs.readFileSync(local),
    md5 = crypto.createHash('md5').update(body).digest('hex')
  // HEAD retries like PUT: one TLS timeout used to kill the whole pass (rc=1, 17:16-18:33)
  for (let i = 0; ; i++) {
    try {
      const h = await s3.send(new HeadObjectCommand({ Bucket, Key: key }))
      if (
        h.ContentLength === body.length &&
        (h.ETag || '').replace(/"/g, '') === md5 &&
        h.ContentType === TYPES[ext] &&
        h.CacheControl === CACHE[ext]
      )
        return 'same'
      break
    } catch (e) {
      if (e?.$metadata?.httpStatusCode === 404 || e?.name === 'NotFound') break
      if (i >= 3) throw e
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i))
    }
  }
  if (dry) return 'would-put'
  for (let i = 0; ; i++) {
    try {
      await s3.send(
        new PutObjectCommand({
          Bucket,
          Key: key,
          Body: body,
          ContentType: TYPES[ext],
          CacheControl: CACHE[ext],
          ContentMD5: Buffer.from(md5, 'hex').toString('base64'),
        }),
      )
      return 'put'
    } catch (e) {
      if (i >= 3) throw e
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i))
    }
  }
}

// The media goes up with a one-year immutable cache, so a half-written or broken file must never be
// uploaded: the batch is still rendering beside this. A video is ready when its mp4 and its cover both
// exist, neither has changed for MIN_AGE, and ffprobe finds a video and an audio stream and a real
// duration in the mp4. Anything else is skipped quietly and picked up by the next pass.
const MIN_AGE = 3 * 60 * 1000,
  MIN_SECONDS = 5
const ready = (mp4) => {
  const jpg = mp4.replace(/\.mp4$/, '.jpg')
  if (!fs.existsSync(jpg)) return false
  const now = Date.now()
  if (now - fs.statSync(mp4).mtimeMs < MIN_AGE || now - fs.statSync(jpg).mtimeMs < MIN_AGE)
    return false
  try {
    const j = JSON.parse(
      execFileSync('ffprobe', [
        '-v',
        'error',
        '-show_entries',
        'stream=codec_type:format=duration',
        '-of',
        'json',
        mp4,
      ]).toString(),
    )
    const types = (j.streams || []).map((x) => x.codec_type)
    return types.includes('video') && types.includes('audio') && +j.format?.duration > MIN_SECONDS
  } catch {
    return false
  }
}
// every mp4 that is ready, with its cover: "<lang>/<name>" pairs. A re-cut of a published video
// goes up under a new name (venus-day030-en-r2.mp4), never over the old one: v1 is immutable.
const readyPairs = () =>
  fs
    .readdirSync(V1, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) =>
      fs
        .readdirSync(path.join(V1, d.name))
        .filter((f) => /^venus-day\d{3}(-return)?-[A-Za-z-]+(-r\d+)?\.mp4$/.test(f))
        .filter((f) => ready(path.join(V1, d.name, f)))
        .flatMap((f) => [`${d.name}/${f}`, `${d.name}/${f.replace(/\.mp4$/, '.jpg')}`]),
    )

async function media() {
  const files = readyPairs()
  const tally = {}
  let n = 0,
    bytes = 0
  const queue = files.slice()
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (queue.length) {
        const rel = queue.shift()
        const r = await put(path.join(V1, rel), `${PREFIX}/${rel}`)
        tally[r] = (tally[r] || 0) + 1
        if (r === 'put') bytes += fs.statSync(path.join(V1, rel)).size
        if (dry && r === 'would-put') console.log('would-put', rel)
        if (++n % 100 === 0) console.log(`${n}/${files.length}`, JSON.stringify(tally))
      }
    }),
  )
  console.log(`media: ${files.length} files`, JSON.stringify(tally), `bytes=${bytes}`)
  return 0
}

async function verify() {
  const remote = new Map()
  let ContinuationToken
  do {
    const r = await s3.send(
      new ListObjectsV2Command({ Bucket, Prefix: `${PREFIX}/`, ContinuationToken }),
    )
    for (const o of r.Contents || [])
      remote.set(o.Key.slice(PREFIX.length + 1), {
        size: o.Size,
        etag: (o.ETag || '').replace(/"/g, ''),
      })
    ContinuationToken = r.IsTruncated ? r.NextContinuationToken : undefined
  } while (ContinuationToken)
  const local = readyPairs()
  const missing = [],
    differ = []
  for (const rel of local) {
    const o = remote.get(rel)
    if (!o) {
      missing.push(rel)
      continue
    }
    const body = fs.readFileSync(path.join(V1, rel))
    if (o.size !== body.length || o.etag !== crypto.createHash('md5').update(body).digest('hex'))
      differ.push(rel)
  }
  const localSet = new Set(local)
  const extra = [...remote.keys()].filter((k) => k !== 'manifest.json' && !localSet.has(k))
  const remoteBytes = [...remote.entries()]
    .filter(([k]) => localSet.has(k))
    .reduce((a, [, o]) => a + o.size, 0)
  console.log(
    JSON.stringify({
      localReady: local.length,
      localMp4: local.filter((f) => f.endsWith('.mp4')).length,
      remoteObjects: remote.size,
      matched: local.length - missing.length - differ.length,
      missing: missing.length,
      differ: differ.length,
      extra: extra.length,
      remoteBytes,
      hasManifest: remote.has('manifest.json'),
    }),
  )
  for (const [k, l] of [
    ['missing', missing],
    ['differ', differ],
    ['extra', extra],
  ])
    for (const f of l.slice(0, 20)) console.log(k, f)
  return missing.length || differ.length ? 1 : 0
}

async function intro() {
  // The film sits beside the days as venus-intro-<lang>.mp4, the master, and is not in the
  // manifest. The app plays a smaller copy put up by hand under a suffix (see the README) and falls
  // back to day 1 when it does not load. All locales or none: a missing or unfinished cut stops the
  // run before anything goes up. And never over an object already there, not even an identical
  // one: a key that exists means somebody published a cut, and a changed cut goes up under a
  // suffix not used yet (see the README).
  const FILM = path.join(OUT_ROOT, 'intro')
  const langs = fs
    .readdirSync(FILM, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
  const files = langs.flatMap((lang) => [
    `${lang}/venus-intro-${lang}.mp4`,
    `${lang}/venus-intro-${lang}.jpg`,
  ])
  const unready = langs.filter((lang) => !ready(path.join(FILM, lang, `venus-intro-${lang}.mp4`)))
  if (langs.length === 0 || unready.length) {
    console.error(`intro: not ready: ${unready.join(', ') || 'no locale rendered'}`)
    return 1
  }
  const there = []
  let ContinuationToken
  do {
    const r = await s3.send(
      new ListObjectsV2Command({ Bucket, Prefix: `${PREFIX}/`, ContinuationToken }),
    )
    for (const o of r.Contents || []) if (o.Key.includes('venus-intro')) there.push(o.Key)
    ContinuationToken = r.IsTruncated ? r.NextContinuationToken : undefined
  } while (ContinuationToken)
  if (there.length) {
    console.error(`intro: already in the bucket, nothing uploaded:\n${there.join('\n')}`)
    return 1
  }
  for (const rel of files) {
    const r = await put(path.join(FILM, rel), `${PREFIX}/${rel}`)
    console.log(r, `${PREFIX}/${rel}`, fs.statSync(path.join(FILM, rel)).size)
  }
  return 0
}

async function manifest() {
  // the app reads { videos: [{ day, lang, file, cover }] } (apps/mobile/src/lib/venusStory.ts): the last
  // path segment of file and cover is the name in the bucket, beside each other in <lang>/
  const src = JSON.parse(fs.readFileSync(path.join(V1, 'manifest.json'), 'utf8'))
  const videos = src.videos
    .filter((v) => fs.existsSync(path.join(V1, v.lang, path.basename(v.file))))
    .map((v) => ({
      day: v.day,
      lang: v.lang,
      ...(v.variant && v.variant !== 'first' ? { variant: v.variant } : {}),
      file: `${v.lang}/${path.basename(v.file)}`,
      cover: v.cover ? `${v.lang}/${path.basename(v.cover)}` : null,
      duration: v.duration,
    }))
  const missingCover = videos.filter((v) => !v.cover || !fs.existsSync(path.join(V1, v.cover)))
  if (missingCover.length) {
    console.error(
      `${missingCover.length} entries without a cover file, e.g. ${missingCover[0].file}`,
    )
    return 1
  }
  const out = path.join(V1, 'manifest.public.json')
  fs.writeFileSync(
    out,
    JSON.stringify({
      version: 1,
      updated: new Date().toISOString(),
      count: videos.length,
      videos,
    }) + '\n',
  )
  console.log(`manifest: ${videos.length} videos ->`, await put(out, `${PREFIX}/manifest.json`))
  return 0
}

switch (mode) {
  case 'usage':
    console.error('usage: node upload.mjs media|manifest|verify|intro [--dry]')
    process.exitCode = 2
    break
  default:
    if (unset.length) {
      console.error(`missing ${unset.join(', ')}`)
      process.exitCode = 1
      break
    }
    process.exitCode = await { media, manifest, verify, intro }[mode]()
}
