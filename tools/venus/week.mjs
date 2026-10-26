// out/v1/week-<lang>.mp4: days 1-7 side by side (4x2 grid, eighth cell a day key), to check that
// consecutive days look and move differently. Silent: seven mixes at once are noise.
//   node week.mjs [--lang tr] [--from 1]
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { outFile } from './render.mjs'
import { planDay } from './grammar.mjs'
import { OUT } from './lib/paths.mjs'
const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k)
  return i > 0 ? process.argv[i + 1] : d
}
const lang = arg('lang', 'tr'),
  from = +arg('from', 1)
const days = Array.from({ length: 7 }, (_, i) => from + i)
for (const d of days)
  if (!fs.existsSync(outFile(d, lang)))
    throw new Error(
      `render day ${d} ${lang} first (node batch.mjs --from ${from} --to ${from + 6} --langs ${lang})`,
    )
const W = 360,
  H = 640
// a key in the eighth cell: what each day picked
const key = days.map((d) => {
  const p = planDay(d, lang)
  return `${d}  ${p.entrance} / ${p.move} / ${p.look}`
})
const txt = path.join(OUT, `.week-${lang}.txt`)
fs.writeFileSync(txt, `${lang}  days ${from}-${from + 6}\n\n` + key.join('\n'))
const inputs = days.flatMap((d) => ['-i', outFile(d, lang)])
const sc = days
  .map((_, i) => `[${i}:v]scale=${W}:${H},setsar=1,tpad=stop_mode=clone:stop_duration=3[v${i}]`)
  .join(';')
const font = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
const cell = `color=c=0x14161b:s=${W}x${H}:d=12,drawtext=fontfile='${font}':textfile='${txt}':fontcolor=white:fontsize=15:line_spacing=10:x=16:y=40[k]`
const layout = days
  .map((_, i) => `${(i % 4) * W}_${Math.floor(i / 4) * H}`)
  .concat([`${3 * W}_${H}`])
  .join('|')
const out = path.join(OUT, `week-${lang}.mp4`)
execFileSync('ffmpeg', [
  '-hide_banner',
  '-loglevel',
  'error',
  '-y',
  ...inputs,
  '-filter_complex',
  `${sc};${cell};${days.map((_, i) => `[v${i}]`).join('')}[k]xstack=inputs=8:layout=${layout},trim=duration=11.2[g]`,
  '-map',
  '[g]',
  '-c:v',
  'libx264',
  '-crf',
  '20',
  '-pix_fmt',
  'yuv420p',
  '-movflags',
  '+faststart',
  out,
])
fs.rmSync(txt)
console.log('wrote', out)
