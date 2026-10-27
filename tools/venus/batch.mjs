// Render many (day, locale) videos in parallel, skip what exists, keep out/v1/manifest.json current.
//
//   node batch.mjs --from 1 --to 100 --langs tr,en
//   node batch.mjs --library                      days 1-100 + the milestones after 100 (200, 365), all 8 locales
//   node batch.mjs --days 1,2,3,30 --langs tr      a hand-picked set
//   options: --workers N (parallel renders, default 4)  --force (re-render existing files)
//
// Day 1 is two files in every locale: the self-introduction and the welcome-back variant
// (lib/intro.mjs). Both are rendered whenever day 1 is in the set.
//
// Each render is its own process with its own headless Chromium: one browser tops out near 90 ms a
// frame, separate ones scale until the CPU is full (4 workers x 3 pages saturates 12 cores).
// voice/needed.json is rewritten on every run: the whole library's lines that lack a real recording.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn, execFileSync } from 'node:child_process'
import { LOCALES, LIBRARY_DAYS, MILESTONES } from './grammar.mjs'
import { planVideo, variantsOf, VARIANT_SUFFIX } from './lib/intro.mjs'
import { writeNeeded } from './lib/voice.mjs'
import { outFile, coverFile } from './render.mjs'
import { GEN, OUT } from './lib/paths.mjs'

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k)
  return i > 0 ? process.argv[i + 1] : d
}
const langs = arg('langs', process.argv.includes('--library') ? LOCALES.join(',') : 'tr,en').split(
  ',',
)
for (const l of langs) if (!LOCALES.includes(l)) throw new Error(`unknown locale ${l}`)
let days
if (process.argv.includes('--library')) days = LIBRARY_DAYS
else if (arg('days')) days = arg('days').split(',').map(Number)
else {
  const a = +arg('from', 1),
    b = +arg('to', 100)
  days = Array.from({ length: b - a + 1 }, (_, i) => a + i)
}
const workers = +arg('workers', Math.max(1, Math.floor(os.cpus().length / 3)))
const force = process.argv.includes('--force')

const MANIFEST = path.join(OUT, 'manifest.json')
const manifest = fs.existsSync(MANIFEST)
  ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
  : { videos: [] }
const keyOf = (lang, day, variant = 'first') => `${lang}/${day}${VARIANT_SUFFIX[variant]}`
const byKey = new Map(manifest.videos.map((v) => [keyOf(v.lang, v.day, v.variant), v]))
const save = () => {
  const videos = [...byKey.values()].sort(
    (a, b) =>
      a.lang.localeCompare(b.lang) ||
      a.day - b.day ||
      (a.variant ?? 'first').localeCompare(b.variant ?? 'first'),
  )
  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(
    MANIFEST,
    JSON.stringify(
      {
        generatedBy: 'tools/venus/batch.mjs',
        updated: new Date().toISOString(),
        count: videos.length,
        videos,
      },
      null,
      1,
    ) + '\n',
  )
}
const probe = (f) =>
  +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f])
    .toString()
    .trim()

const jobs = []
const plans = []
for (const lang of langs)
  for (const day of days)
    for (const variant of variantsOf(day)) {
      const plan = planVideo(day, lang, variant)
      plans.push(plan)
      const out = outFile(day, lang, variant)
      if (!force && fs.existsSync(out)) {
        // already rendered: make sure the manifest knows it (a run that was interrupted, or files copied in)
        const k = keyOf(lang, day, variant)
        if (!byKey.has(k) || byKey.get(k).quipId !== plan.quip.id)
          byKey.set(k, {
            day,
            lang,
            variant,
            file: path.relative(GEN, out),
            cover: fs.existsSync(coverFile(out)) ? path.relative(GEN, coverFile(out)) : null,
            duration: probe(out),
            quipId: plan.quip.id,
            milestone: MILESTONES.includes(day),
          })
        continue
      }
      jobs.push({ day, lang, variant })
    }
// needed.json always covers the whole library (every locale), plus anything requested outside it
const needed = writeNeeded([
  ...LOCALES.flatMap((l) =>
    LIBRARY_DAYS.flatMap((d) => variantsOf(d).map((v) => planVideo(d, l, v))),
  ),
  ...plans,
])
console.log(
  `${jobs.length} to render, ${plans.length - jobs.length} already there; ${workers} workers. ${needed.length} lines still need a real voice (voice/needed.json).`,
)
save()

const t0 = Date.now()
let done = 0,
  failed = 0
async function run(job) {
  return new Promise((resolve) => {
    const p = spawn(
      process.execPath,
      [
        path.join(GEN, 'render.mjs'),
        '--day',
        String(job.day),
        '--lang',
        job.lang,
        '--variant',
        job.variant,
        '--pages',
        '3',
        ...(force ? ['--force'] : []),
      ],
      { cwd: GEN },
    )
    let outText = '',
      errText = ''
    p.stdout.on('data', (d) => {
      outText += d
    })
    p.stderr.on('data', (d) => {
      errText += d
    })
    p.on('close', (code) => {
      const line = outText.split('\n').find((l) => l.startsWith('RESULT '))
      if (code === 0 && line) {
        const r = JSON.parse(line.slice(7))
        byKey.set(keyOf(job.lang, job.day, job.variant), {
          day: job.day,
          lang: job.lang,
          variant: job.variant,
          file: r.file,
          cover: r.cover,
          duration: r.duration,
          quipId: r.quipId,
          milestone: MILESTONES.includes(job.day),
          lufs: r.lufs,
          truePeak: r.truePeak,
          placeholderVoice: r.placeholderVoice,
          plan: r.plan,
          renderSeconds: r.seconds,
        })
        done++
        const el = (Date.now() - t0) / 1000,
          eta = (el / (done + failed)) * (jobs.length - done - failed)
        console.log(
          `[${done + failed}/${jobs.length}] ${job.lang} day ${job.day}${VARIANT_SUFFIX[job.variant]}: ${r.duration.toFixed(2)}s video, ${r.seconds}s render · eta ${(eta / 60).toFixed(1)} min`,
        )
        save()
      } else {
        failed++
        console.error(
          `FAILED ${job.lang} day ${job.day}${VARIANT_SUFFIX[job.variant]} (exit ${code})\n${errText.slice(-1500)}`,
        )
      }
      resolve()
    })
  })
}
const queue = jobs.slice()
await Promise.all(
  Array.from({ length: Math.min(workers, queue.length) }, async () => {
    while (queue.length) await run(queue.shift())
  }),
)
save()
const el = (Date.now() - t0) / 1000
console.log(
  `done: ${done} rendered, ${failed} failed, in ${(el / 60).toFixed(1)} min (${done ? (el / done).toFixed(1) : '-'} s per video of wall time). manifest: ${path.relative(GEN, MANIFEST)}`,
)
if (failed) process.exitCode = 1
