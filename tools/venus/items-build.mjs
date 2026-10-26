// Builds everything that is derived from data/items.json:
//   node items-build.mjs --doc        inventory.md (a test fails if it drifts from the registry)
//   node items-build.mjs --assets     assets/items/<id>.svg, each item at rest (the registry's `art` paths)
//   node items-build.mjs --catalog    out/items/catalog.png: every drawn item as a sticker + in use on Venus
//   node items-build.mjs --food       out/items/food-catalog.png: the food category only
//   node items-build.mjs              all four
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import {
  REGISTRY,
  ITEMS,
  hasArt,
  IMPLEMENTED,
  restArt,
  applyItemPose,
  itemLayers,
  slotOf,
} from './lib/items.mjs'
import { EXTRA_EXPR } from './lib/score.mjs'
import { RIG, GEN, OUT_ROOT } from './lib/paths.mjs'

const V = createRequire(import.meta.url)(path.join(RIG, 'venus-rig.js'))
Object.assign(V.EXPR, EXTRA_EXPR)
export const DOC = path.join(GEN, 'inventory.md')
export const ASSET_DIR = path.join(GEN, 'assets/items')
export const artPath = (id) => `assets/items/${id}.svg`

// ------------------------------------------------------------------ inventory.md
export function inventoryMd(reg = REGISTRY) {
  const items = reg.items
  const L = []
  L.push('# Venus: item inventory', '')
  L.push(
    'Generated from `data/items.json` by `node items-build.mjs --doc`. Do not edit by hand: the registry is the',
    'source, and `test/items.test.mjs` fails if this file drifts from it.',
    '',
  )
  const by = (c) => items.filter((i) => i.category === c)
  const count = (p) => items.filter((i) => i.priority === p).length
  const drawn = items.filter((i) => i.kind !== 'none' && i.kind !== 'rig').length
  L.push(
    `**${items.length} items** in ${Object.keys(reg.categories).length} categories: ${count('P0')} P0 (needed for the first mass render), ${count('P1')} P1, ${count('P2')} P2 (catalogued, not drawn). ${drawn} are drawn in \`lib/items-art.mjs\`; the two outfits are drawn by the rig.`,
    '',
  )
  L.push('| Category | Items | P0 | P1 | P2 |', '|---|---|---|---|---|')
  for (const [c, name] of Object.entries(reg.categories)) {
    const l = by(c)
    L.push(
      `| ${name} | ${l.length} | ${l.filter((i) => i.priority === 'P0').length} | ${l.filter((i) => i.priority === 'P1').length} | ${l.filter((i) => i.priority === 'P2').length} |`,
    )
  }
  L.push('')
  L.push('## How items enter a video', '')
  L.push(
    '- **One hero item a day, at most.** A throne day is about the throne; milestones may carry their set (up to a seat plus two).',
  )
  L.push(
    `- **Rest days.** About ${Math.round(reg.rules.restShare * 100)} % of ordinary days carry no item, so items stay a treat.`,
  )
  L.push(
    '- **Never the same item two days running**, and each item has a cooldown in days before it may return (a quip that calls for it overrides the cooldown, never the two-days rule).',
  )
  L.push(
    '- **Milestone-only items** (crown, party hat, trophy, cake, confetti cannon, medal, gift, balloon) appear on milestones only.',
  )
  L.push(`- **Bag lines get a bag.** ${reg.rules.bagLines}`)
  L.push(
    "- **The throne** appears exactly when the score builds it (the `bag-throne` move or the `bag-hop` entrance). It replaces the rig's old yellow plastic bag.",
  )
  L.push(
    '- **Seasonal items** are catalogued but never picked: the shared streak video is keyed by streak day and cannot know the date.',
  )
  L.push(`- **Placement.** ${reg.rules.propSides}`)
  L.push('')
  L.push('## Milestone sets', '', '| Day | Items |', '|---|---|')
  for (const [d, ids] of Object.entries(reg.milestoneSets))
    L.push(`| ${d} | ${ids.map((i) => ITEMS[i].name).join(', ') || '—'} |`)
  L.push('')
  L.push(
    '## Interactions',
    '',
    '| Interaction | What it looks like | Implemented |',
    '|---|---|---|',
  )
  for (const [k, v] of Object.entries(reg.interactions))
    L.push(`| \`${k}\` | ${v} | ${IMPLEMENTED.has(k) ? 'yes' : 'no'} |`)
  L.push('')
  for (const [c, name] of Object.entries(reg.categories)) {
    L.push(`## ${name}`, '')
    for (const it of by(c)) {
      L.push(`### ${it.name} \`${it.id}\` · ${it.priority}`, '')
      L.push(`- **Why it's funny or lovable:** ${it.why}`)
      L.push(
        `- **Gag / beat:** ${it.beat} (gags: ${it.gags.join(', ')}; formula ${it.formula.join(', ')})`,
      )
      const days = []
      const ms = Object.entries(reg.milestoneSets)
        .filter(([, ids]) => ids.includes(it.id))
        .map(([d]) => d)
      if (ms.length) days.push(`milestones ${ms.join(', ')}`)
      if (it.seasonalOnly) days.push('seasonal campaigns only, never the streak video')
      else if (it.milestoneOnly) days.push('milestones only')
      else if (it.pickable === false && !it.quips.length)
        days.push('drawn, not in rotation yet: no line calls for it (`pickable: false`)')
      else if (it.pickable === false) days.push('only when its line plays')
      else if (it.kind !== 'none')
        days.push(
          it.moods ? `ordinary days, moods: ${it.moods.join(', ')}` : 'ordinary days, any mood',
        )
      else days.push('not in the grammar yet')
      if (it.quips.length) days.push(`lines: ${it.quips.join(', ')}`)
      L.push(
        `- **Days:** ${days.join('; ')}. Cooldown ${it.cooldown ?? reg.rules.defaultCooldown} days.`,
      )
      L.push(
        `- **Rig interaction:** \`${it.interaction}\`${it.needsRigMove ? ` — needs a new rig move: ${it.needsRigMove}` : ''}.`,
      )
      L.push(
        `- **Art:** ${it.kind === 'rig' ? 'drawn by the rig (`outfit`)' : it.kind === 'none' ? 'not drawn yet' : `\`${artPath(it.id)}\` (\`${it.draw}\` in items-art.mjs)`}. **Locale:** ${it.localeNotes}`,
      )
      L.push('')
    }
  }
  return L.join('\n')
}

// ------------------------------------------------------------------ assets
function assetSvg(id) {
  const a = restArt(id)
  const [x, y, w, h] = a.box
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}">${a.svg}</svg>\n`
}

// ------------------------------------------------------------------ Venus in use with an item
const POSE = {
  expr: 'proud',
  tail: { pitch: 70, yaw: 95, side: -20, curl: 100, hook: 120, len: 1.15 },
}
export function inUse(id, { lang = 'en', day = 2, t = 1.2, expr } = {}) {
  const it = ITEMS[id]
  const P = V.pose({ ...POSE, expr: expr || POSE.expr, outfit: it.kind === 'rig' ? id : null })
  const slot = slotOf(it)
  const IT = {
    day,
    lang,
    side: 1,
    ids: [id],
    seat: null,
    wear: null,
    neck: null,
    prop: null,
    air: null,
    seatMode: 'always',
    [slot]: id,
  }
  const sc = { R: 0.2, T: { v: 0.3, e: 2, sents: [{ t0: 0.4, t1: 1.6 }] }, endAt: 99, blink: 99 }
  if (it.kind === 'seat') P.bag = 1
  if (it.kind !== 'rig') applyItemPose(IT, t, P, sc)
  const fig = V.draw(P)
  return it.kind === 'rig' ? fig : itemLayers(IT, t, P, fig, sc)
}

// ------------------------------------------------------------------ catalog
const DIE = `<filter id="die" x="-30%" y="-30%" width="160%" height="160%"><feMorphology in="SourceAlpha" operator="dilate" radius="9" result="d"/><feFlood flood-color="#ffffff"/><feComposite in2="d" operator="in" result="w"/><feGaussianBlur in="d" stdDeviation="5"/><feOffset dy="5" result="b"/><feFlood flood-color="#14161B" flood-opacity="0.22"/><feComposite in2="b" operator="in" result="sh"/><feMerge><feMergeNode in="sh"/><feMergeNode in="w"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`
const noShadow = (s) => s.replace(/<ellipse [^>]*fill="#14161B" opacity="[\d.]+"\/>/g, '')
async function catalog({
  category = null,
  out = path.join(OUT_ROOT, 'items/catalog.png'),
  title = 'Venus · item catalog',
} = {}) {
  const { openBrowser } = await import('./lib/frames.mjs')
  const list = REGISTRY.items.filter((i) => hasArt(i) && (!category || i.category === category))
  const cols = 6,
    TW = 330,
    TH = 470,
    PADT = 150
  const rows = Math.ceil(list.length / cols),
    Wd = cols * TW + 60,
    Ht = rows * TH + PADT + 40
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${Wd}" height="${Ht}" viewBox="0 0 ${Wd} ${Ht}"><defs>${DIE}<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4b7bf8"/><stop offset="1" stop-color="#3b6cf6"/></linearGradient></defs><rect width="100%" height="100%" fill="#F4F1EA"/>`
  s += `<text x="40" y="78" font-family="Nunito" font-weight="900" font-size="56" fill="#14161B">${title}</text><text x="40" y="118" font-family="Nunito" font-weight="800" font-size="24" fill="#6b6f7a">${list.length} drawn items · sticker (top) and in use at story scale (bottom) · P0 badge yellow, P1 grey · generated from data/items.json</text>`
  list.forEach((it, i) => {
    const x = 30 + (i % cols) * TW,
      y = PADT + Math.floor(i / cols) * TH
    s += `<g transform="translate(${x} ${y})"><rect x="6" y="6" width="${TW - 12}" height="${TH - 12}" rx="24" fill="#ffffff" stroke="#14161B" stroke-width="4"/>`
    // sticker
    if (it.kind !== 'rig') {
      const a = restArt(it.id, { lang: 'tr', day: 22 }),
        [bx, by, bw, bh] = a.box,
        k = Math.min(250 / bw, 180 / bh)
      s += `<g transform="translate(${TW / 2} ${30 + 90}) scale(${k}) translate(${-(bx + bw / 2)} ${-(by + bh / 2)})"><g filter="url(#die)">${noShadow(a.svg)}</g></g>`
    }
    // in use, on the brand ground
    s += `<clipPath id="cl${i}"><rect x="18" y="222" width="${TW - 36}" height="168" rx="14"/></clipPath><g clip-path="url(#cl${i})"><rect x="18" y="222" width="${TW - 36}" height="168" fill="url(#bg)"/><rect x="18" y="360" width="${TW - 36}" height="40" fill="#2e5de2"/>`
    const tall = ['speech-sign', 'balloon', 'feather-wand', 'globe', 'moth', 'suitcase'].includes(
      it.id,
    )
    const sc = tall ? 0.26 : 0.32
    s += `<g transform="translate(${TW / 2 - (it.kind === 'floor' ? 30 : 0)} ${tall ? 380 : 382}) scale(${sc})">${inUse(it.id, { lang: 'tr' })}</g></g>`
    s += `<rect x="18" y="222" width="${TW - 36}" height="168" rx="14" fill="none" stroke="#14161B" stroke-width="3"/>`
    s += `<text x="24" y="428" font-family="Nunito" font-weight="900" font-size="25" fill="#14161B">${it.name}</text>`
    s += `<text x="24" y="452" font-family="Nunito" font-weight="800" font-size="17" fill="#6b6f7a">${it.id} · ${it.interaction}</text>`
    s += `<rect x="${TW - 74}" y="20" width="52" height="30" rx="15" fill="${it.priority === 'P0' ? '#FFC409' : '#d9dde5'}" stroke="#14161B" stroke-width="3"/><text x="${TW - 48}" y="42" font-family="Nunito" font-weight="900" font-size="18" text-anchor="middle" fill="#14161B">${it.priority}</text>`
    s += `</g>`
  })
  s += '</svg>'
  const B = await openBrowser()
  try {
    await B.render([{ svg: s, w: Wd, h: Ht, out }], 1)
  } finally {
    await B.close()
  }
  console.log('wrote', out, Wd + 'x' + Ht)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const all = !process.argv.slice(2).some((a) => a.startsWith('--'))
  if (all || process.argv.includes('--doc')) {
    fs.mkdirSync(path.dirname(DOC), { recursive: true })
    fs.writeFileSync(DOC, inventoryMd() + '\n')
    console.log('wrote', DOC)
  }
  if (all || process.argv.includes('--assets')) {
    fs.mkdirSync(ASSET_DIR, { recursive: true })
    for (const it of REGISTRY.items)
      if (hasArt(it) && it.kind !== 'rig')
        fs.writeFileSync(path.join(GEN, artPath(it.id)), assetSvg(it.id))
    console.log('wrote', ASSET_DIR)
  }
  if (all || process.argv.includes('--catalog')) await catalog()
  if (all || process.argv.includes('--food'))
    await catalog({
      category: 'food',
      out: path.join(OUT_ROOT, 'items/food-catalog.png'),
      title: 'Venus · the kitchen',
    })
}
