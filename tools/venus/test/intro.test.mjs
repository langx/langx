// node --test test/*.test.mjs   (from tools/venus/)  — the day-1 specials (lib/intro.mjs)
import test from 'node:test'
import assert from 'node:assert/strict'
import { LOCALES, planDay } from '../grammar.mjs'
import { LINES, VARIANTS, planVideo, LIBRARY_VIDEOS } from '../lib/intro.mjs'
import { ENTRANCES, REACTIONS, MOVE_IMPL, PAYOFFS, CAMERAS } from '../lib/score.mjs'
import { LOOKS } from '../lib/layers.mjs'
import { sentences } from '../lib/voice.mjs'
import { lintIntroLines } from '../lint-quips.mjs'

// the bible's red lines (§4.3) that a welcome-back could slip into, in the two native locales
const BANNED = {
  en: /\b(miss|missed|lost|lose|where were you|finally|waited|again|back again|should|must|watching)\b/i,
  tr: /(özledim|neredeydin|nihayet|bekledim|kaybet|yine|tekrar|izliyorum|-malısın|-melisin)/i,
}

for (const variant of VARIANTS) {
  test(`${variant}: every locale has the line, number-free, with the beats' sentence count`, () => {
    const L = LINES[variant]
    for (const lang of LOCALES) {
      const text = L.text[lang]
      assert.ok(text, `${lang} missing`)
      assert.ok(!/\d/.test(text), `${lang} has a digit`)
      assert.equal(
        sentences(text).length,
        L.roles.length,
        `${lang}: ${sentences(text)
          .map((s) => s.text)
          .join(' | ')}`,
      )
      assert.ok((text.match(/…/g) || []).length <= 2, `${lang}: too many beats`)
    }
    for (const lang of ['en', 'tr'])
      assert.ok(!BANNED[lang].test(L.text[lang]), `${lang}: ${L.text[lang]}`)
  })

  test(`${variant}: every locale passes the character lint`, () => {
    assert.deepEqual(lintIntroLines({ [variant]: LINES[variant] }), [])
  })

  test(`${variant}: the plan is implemented, day 1, and differs from day 2 on every axis`, () => {
    for (const lang of LOCALES) {
      const p = planVideo(1, lang, variant),
        d2 = planDay(2, lang)
      assert.equal(p.day, 1)
      assert.ok(
        ENTRANCES[p.entrance] &&
          REACTIONS[p.reaction] &&
          MOVE_IMPL[p.move] &&
          PAYOFFS[p.payoff] &&
          CAMERAS[p.camera] &&
          LOOKS[p.look],
        `${lang} ${variant}`,
      )
      for (const k of ['entrance', 'look', 'camera', 'reveal', 'payoff'])
        assert.notEqual(p[k], d2[k], `${lang} ${k}`)
      assert.notEqual(p.quip.pool, 'comeback')
    }
  })
}

test('other days are the grammar, and only day 1 has a return variant', () => {
  assert.deepEqual(planVideo(22, 'tr'), planDay(22, 'tr'))
  assert.throws(() => planVideo(22, 'tr', 'return'))
  assert.equal(LIBRARY_VIDEOS.filter((v) => v.variant === 'return').length, LOCALES.length)
  assert.equal(LIBRARY_VIDEOS.filter((v) => v.day === 1).length, LOCALES.length * 2)
})
