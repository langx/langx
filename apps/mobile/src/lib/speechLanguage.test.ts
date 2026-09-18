import { describe, expect, it } from 'vitest'
import { speechLanguageFor } from './speechLanguage'

/**
 * The detector against real sentences, which is the only way this feature can
 * be known to work.
 *
 * Every unit test around it passed while it was broken: they fed the detector's
 * answer in, so they proved the rules and said nothing about whether `franc`
 * ever produces a usable answer on a chat message. It mostly did not — asked
 * openly it read "Hey! How was your weekend?" as Afrikaans and "see you
 * tomorrow" as Haitian Creole, and two of nine ordinary messages got the row.
 *
 * So this file runs the real thing end to end and counts. If a future change to
 * the candidate list or the length floor quietly costs us the button again,
 * the number here moves.
 */
describe('speechLanguageFor, against sentences people actually send', () => {
  /** Turkish native learning English, talking to an English native learning Turkish. */
  const pair = ['tr', 'en', 'en', 'tr']

  const english = [
    'Hey! How was your weekend?',
    'I went to the cinema with my friends yesterday',
    'Could you correct this sentence for me please?',
    'see you tomorrow',
    'Good morning, I hope you slept well',
    'What does "take it easy" mean exactly?',
    'I have been learning English for two years',
    'Nice to meet you! Where are you from?',
  ]

  it('reads ordinary English in an English thread', () => {
    for (const body of english) {
      expect(speechLanguageFor(body, { contextLangs: pair }), body).toBe('en')
    }
  })

  it('refuses Turkish, which has no voice we are licensed to ship', () => {
    for (const body of [
      'Bugün hava gerçekten çok güzel görünüyor',
      'Merhaba, nasılsın? Bugün ne yaptın?',
      'Yarın buluşalım mı, ne dersin?',
    ]) {
      expect(speechLanguageFor(body, { contextLangs: pair }), body).toBeUndefined()
    }
  })

  it('says nothing about a message too short to tell', () => {
    for (const body of ['ok', 'thanks!', 'haha', '👍']) {
      expect(speechLanguageFor(body, { contextLangs: pair }), body).toBeUndefined()
    }
  })

  it('tells German from Dutch, which trigrams find hard and this pair does not', () => {
    const dutchLearner = ['de', 'nl', 'nl', 'de']
    expect(
      speechLanguageFor('Guten Morgen, wie geht es dir heute?', { contextLangs: dutchLearner }),
    ).toBe('de')
    expect(
      speechLanguageFor('Goedemorgen, hoe gaat het vandaag met je?', {
        contextLangs: dutchLearner,
      }),
    ).toBe('nl')
  })

  it('believes a translation provider over the detector', () => {
    // Too short for trigrams, but Google already read it.
    expect(speechLanguageFor('ok', { sourceLang: 'de', contextLangs: pair })).toBe('de')
  })
})
