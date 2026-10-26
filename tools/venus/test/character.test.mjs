// The character rules: data/character.json is sane, the generator reads it, and the lint passes the
// real quip bank while rejecting every kind of offender.   node --test test/*.test.mjs   (from tools/venus/)
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { CHARACTER } from '../lib/character.mjs'
import { lintQuips, checkText, QUIPS_FILE } from '../lint-quips.mjs'
import { REACTION_BY_MOOD, MOVES, MILESTONES, AXES, LOCALES, planDay } from '../grammar.mjs'
import { REACTIONS, MOVE_IMPL, PAYOFFS, EXTRA_EXPR } from '../lib/score.mjs'
import { RIG } from '../lib/paths.mjs'

const QUIPS = JSON.parse(fs.readFileSync(QUIPS_FILE, 'utf8'))
const clone = (o) => JSON.parse(JSON.stringify(o))
const quip = (q, id) =>
  Object.values(q.pools)
    .flat()
    .find((x) => x.id === id)
const cats = (text, loc, target) => checkText(text, loc, { target }).map((h) => h.category)

// ---------------------------------------------------------------- the data
test('character.json: every regex compiles and every category has a reason', () => {
  for (const [cat, def] of Object.entries(CHARACTER.lint.categories)) {
    assert.ok(def.why, `${cat} needs a why`)
    for (const [k, list] of Object.entries(def))
      if (Array.isArray(list))
        for (const s of list) assert.doesNotThrow(() => new RegExp(s, 'iu'), `${cat}.${k}: ${s}`)
  }
})

test('character.json: acting data points at things the rig and the score implement', () => {
  const V = createRequire(import.meta.url)(path.join(RIG, 'venus-rig.js'))
  const faces = new Set([...Object.keys(V.EXPR), ...Object.keys(EXTRA_EXPR)])
  const A = CHARACTER.acting
  for (const m of A.moves) assert.ok(MOVE_IMPL[m], `move ${m}`)
  for (const [m, alt] of Object.entries(A.altMove)) {
    assert.ok(A.moves.includes(m) && A.moves.includes(alt), `alt ${m} -> ${alt}`)
    assert.notEqual(m, alt)
  }
  for (const list of Object.values(A.reactionByMood))
    for (const r of list) assert.ok(REACTIONS[r], `reaction ${r}`)
  for (const f of Object.values(A.faceByExpression)) assert.ok(faces.has(f), `face ${f}`)
  for (const f of [
    ...Object.values(A.warmFaceByPool),
    ...Object.values(CHARACTER.teases.closingFace),
    CHARACTER.signOff.face,
  ])
    assert.ok(faces.has(f), `face ${f}`)
  for (const f of Object.values(CHARACTER.teases.closingFace))
    assert.ok(!['smug', ...A.bannedFacesAtViewer].includes(f), `a tease never closes on ${f}`)
  for (const p of CHARACTER.signOff.payoffs) assert.ok(PAYOFFS[p], `payoff ${p}`)
})

test('character.json: the schedule is 2 warm to 1 sting with no stings back to back', () => {
  const S = CHARACTER.schedule
  const sting = S.pattern.filter((p) => S.stingPools.includes(p)).length
  assert.ok(S.pattern.length - sting >= S.warmToSting * sting)
  S.pattern.forEach((p, i) =>
    assert.ok(
      !(S.stingPools.includes(p) && S.stingPools.includes(S.pattern[(i + 1) % S.pattern.length])),
    ),
  )
  for (const p of S.neverInStory) assert.ok(!S.pattern.includes(p))
})

test('the generator reads its choices from character.json', () => {
  assert.equal(REACTION_BY_MOOD, CHARACTER.acting.reactionByMood)
  assert.equal(MOVES, CHARACTER.acting.moves)
  assert.equal(MILESTONES, CHARACTER.milestones.days)
  assert.equal(AXES.payoff.options, CHARACTER.signOff.payoffs)
  for (let n = 1; n <= 60; n++)
    assert.equal(
      planDay(n, 'en').quip.pool,
      MILESTONES.includes(n) ? 'milestones' : CHARACTER.schedule.pattern[(n - 1) % 6],
    )
})

// ---------------------------------------------------------------- the lint on the real bank
test('lint: the quip bank passes, every locale', () => {
  const { errors, stats } = lintQuips(QUIPS)
  assert.deepEqual(errors, [])
  assert.ok(stats.selfShare >= CHARACTER.teases.minShare.self, `self share ${stats.selfShare}`)
  assert.ok(stats.warm >= CHARACTER.schedule.warmToSting * stats.sting)
})

test('every locale has the whole story pool, about as long as en and tr', () => {
  const story = [...CHARACTER.schedule.pattern, 'milestones']
    .flatMap((p) => QUIPS.pools[p])
    .filter((q) => !q.id.startsWith('ms-') || q.id.endsWith('-a'))
  for (const lang of LOCALES)
    for (const q of story) {
      const t = q.text[lang]
      assert.ok(t, `${q.id} has no ${lang} text`)
      // the video's timing is cut to the line; a much longer one gets sped up or overruns
      const ref = Math.max(q.text.en.length, q.text.tr.length)
      assert.ok(
        t.length <= ref * 1.6,
        `${q.id} ${lang} is ${t.length} characters against ${ref}: ${t}`,
      )
    }
})

// ---------------------------------------------------------------- the lint rejects offenders
test('lint: the old ro-04 and reg-17 (time of day) fail in every locale they had', () => {
  const q = clone(QUIPS)
  quip(q, 'ro-04').text = {
    en: 'At this hour? Even the fridge is asleep. Respect.',
    tr: 'Bu saatte mi? Buzdolabı bile uyuyor. Saygı.',
    es: '¿A estas horas? Hasta la nevera duerme. Respeto.',
    fr: 'À cette heure-ci ? Même le frigo dort. Respect.',
    de: 'Um diese Uhrzeit? Sogar der Kühlschrank schläft. Respekt.',
    ru: 'В такое время? Даже холодильник спит. Уважаю.',
    ar: 'في هذه الساعة؟ حتى الثلاجة نائمة. احترامي.',
    'pt-BR': 'A essa hora? Até a geladeira tá dormindo. Respeito.',
  }
  quip(q, 'reg-17').text = {
    en: 'Every day, same time? Very cat of you. Routine is everything.',
    tr: 'Her gün aynı saatte mi? Çok kedice. Rutin her şeydir.',
  }
  const { errors } = lintQuips(q)
  assert.equal(
    errors.filter((e) => e.startsWith('ro-04') && e.includes('timeOfDay')).length,
    8,
    errors.join('\n'),
  )
  assert.equal(
    errors.filter((e) => e.startsWith('reg-17') && e.includes('timeOfDay')).length,
    2,
    errors.join('\n'),
  )
})

const OFFENDERS = [
  ['digs at effort or ability', 'viewerDig', 'en', 'Not bad. Try harder tomorrow.'],
  ['digs at the accent', 'viewerDig', 'en', 'Your accent is adorable. Keep going.'],
  ['ranks the viewer below her', 'viewerDig', 'tr', 'İstikrarlı. Zarif. Neredeyse benim kadar.'],
  [
    'effort in a tease aimed at the viewer',
    'habitEffort',
    'en',
    'Could be better. More practice, maybe.',
    'habit',
  ],
  [
    'effort in a tease aimed at the viewer (tr)',
    'habitEffort',
    'tr',
    'Daha iyisi olabilirdi. Biraz daha çaba.',
    'habit',
  ],
  ['watching', 'surveillance', 'en', "Yes, I'm watching. Always."],
  ['reads chats', 'surveillance', 'tr', 'Yazdıklarını okudum. Fena değil.'],
  ['time of day', 'timeOfDay', 'en', 'Studying tonight? Bold.'],
  ['weekday', 'timeOfDay', 'de', 'Unter der Woche so fleißig? Respekt.'],
  ['digits', 'number', 'en', 'Day 7. Nice.'],
  ['digits in Arabic script', 'number', 'ar', 'اليوم ٧. رائع.'],
  ['spelled numbers', 'number', 'en', 'Thirty days of you.'],
  ['guilt', 'guilt', 'en', 'I missed you. Where were you?'],
  ['guilt (tr)', 'guilt', 'tr', 'Seni özledim. Neredeydin?'],
  ['innuendo', 'innuendo', 'en', 'Hey cutie. Kiss for the streak?'],
  ['innuendo (es slang trap)', 'innuendo', 'es', 'Soy una gata elegante.'],
  ['innuendo (pt-BR flirty wink)', 'innuendo', 'pt-BR', 'Te dei uma piscadinha.'],
  ['spelled numbers (es)', 'number', 'es', 'Treinta días contigo.'],
  ['spelled numbers in Arabic', 'number', 'ar', 'ثلاثون يومًا.'],
  [
    'effort in a tease aimed at the viewer (de)',
    'habitEffort',
    'de',
    'Könnte besser sein. Mehr üben, vielleicht.',
    'habit',
  ],
  ['selling', 'selling', 'en', 'Go Pro for more bags.'],
]
for (const [name, cat, loc, text, target = null] of OFFENDERS) {
  test(`lint rejects ${name}`, () => {
    assert.ok(
      cats(text, loc, target).includes(cat),
      `${cat} not found in ${JSON.stringify(cats(text, loc, target))}`,
    )
    const q = clone(QUIPS)
    const victim = target ? quip(q, 'ro-06') : quip(q, 'reg-02')
    victim.text[loc] = text
    assert.ok(
      lintQuips(q).errors.some((e) => e.includes(cat)),
      'the bank lint catches it too',
    )
  })
}

test('lint lets the idioms and friendly words through', () => {
  for (const [loc, text, target] of [
    ['en', 'High five? I only give paws to cameras. Here.'],
    ['en', 'You practise more than I groom. And I groom constantly.'],
    ['fr', "Premier jour. J'ai déjà décidé que je t'aime bien."],
    ['en', "A whole week. I've worn outfits for less."],
    ['en', 'Back again? Suspicious. Keep being suspicious.', 'habit'],
  ]) {
    assert.deepEqual(cats(text, loc, target ?? null), [], text)
  }
})

test('lint enforces the structure: tease targets, self share, ratio, milestones', () => {
  let q = clone(QUIPS)
  for (const t of q.pools.roast) if (t.target === 'self') t.target = 'situation'
  assert.ok(lintQuips(q).errors.some((e) => e.startsWith('teases: self share')))

  q = clone(QUIPS)
  q.pools.roast[0].target = 'person'
  assert.ok(lintQuips(q).errors.some((e) => e.includes('tease target "person"')))

  q = clone(QUIPS)
  q.schedule.pattern = ['praise', 'roast', 'roast', 'regular', 'roast', 'roast']
  const e = lintQuips(q).errors
  assert.ok(
    e.some((x) => x.includes('warm:sting')) && e.some((x) => x.includes('two stings in a row')),
  )

  q = clone(QUIPS)
  q.pools.milestones = q.pools.milestones.filter((m) => m.id !== 'ms-30-a')
  assert.ok(lintQuips(q).errors.some((x) => x.startsWith('ms-30-a: missing')))

  q = clone(QUIPS)
  quip(q, 'pr-01').expression = 'sad-at-you'
  assert.ok(lintQuips(q).errors.some((x) => x.includes('has no face')))
})

test('lint CLI exits non-zero on a bad bank', async () => {
  const { execFileSync } = await import('node:child_process')
  const q = clone(QUIPS)
  quip(q, 'reg-02').text.en = 'At this hour? Bold.'
  const f = path.join(path.dirname(QUIPS_FILE), '..', 'gen', 'work', `lint-bad-${process.pid}.json`)
  fs.mkdirSync(path.dirname(f), { recursive: true })
  fs.writeFileSync(f, JSON.stringify(q))
  try {
    assert.throws(() =>
      execFileSync(
        process.execPath,
        [path.join(path.dirname(QUIPS_FILE), '..', 'gen', 'lint-quips.mjs'), f],
        { stdio: 'pipe' },
      ),
    )
  } finally {
    fs.rmSync(f, { force: true })
  }
})
