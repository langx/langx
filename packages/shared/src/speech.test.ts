import { describe, expect, it } from 'vitest'
import { ECHO_SYNTH_VOICES } from './echoPacks'
import {
  attributedVoices,
  detectSpeechLanguage,
  isSpeakableLength,
  messageSpeechSchema,
  SPEECH_LANGUAGES,
  SPEECH_MIN_CANDIDATES,
  SPEECH_MIN_DETECT_LENGTH,
  speechDetectCandidates,
  speechLanguageFromIso3,
  speechVoicesFor,
  SPEECH_VOICES,
  TTS_MAX_TEXT_LENGTH,
} from './speech'

describe('the voice table', () => {
  it('reads thirty languages, and not the ones it must not', () => {
    expect(SPEECH_LANGUAGES).toHaveLength(30)
    // The catalogue has voices for all four. Every one of them is CC BY-NC,
    // which an app that sells subscriptions cannot use — so they stay silent
    // rather than being read by a model we are not allowed to ship.
    for (const unlicensed of ['tr', 'ar', 'ja', 'ko']) {
      expect(speechVoicesFor(unlicensed)).toEqual([])
    }
    // And two this engine cannot use, which is a different reason — see the
    // note on `SPEECH_VOICES`.
    for (const unsupported of ['lt', 'zh']) {
      expect(speechVoicesFor(unsupported)).toEqual([])
    }
  })

  it('leads every language with a voice, and keeps Kokoro first where it reads', () => {
    for (const lang of SPEECH_LANGUAGES) {
      expect(speechVoicesFor(lang).length).toBeGreaterThan(0)
    }
    // Chat plays `[0]`, and Echo synthesises Kokoro's list in order. They must
    // agree or the two surfaces write two objects for the same sentence.
    for (const [lang, voices] of Object.entries(ECHO_SYNTH_VOICES)) {
      expect(speechVoicesFor(lang).map((voice) => voice.id)).toEqual([...voices])
      expect(speechVoicesFor(lang)[0]?.engine).toBe('kokoro')
    }
  })

  it('credits every voice whose licence obliges it, and only those', () => {
    for (const voice of Object.values(SPEECH_VOICES).flat()) {
      if (voice.license === 'CC-BY-4.0' || voice.license === 'CC-BY-SA-4.0') {
        expect(voice.attribution, voice.id).toBeTruthy()
      } else {
        expect(voice.attribution, voice.id).toBeUndefined()
      }
      if (voice.engine === 'piper') expect(voice.model, voice.id).toMatch(/\.onnx$/)
    }
    expect(attributedVoices().length).toBeGreaterThan(0)
    expect(attributedVoices().every((voice) => voice.attribution)).toBe(true)
  })
})

describe('detectSpeechLanguage', () => {
  /** A stand-in for `franc`: answers with whichever candidate the caller planted. */
  const detector = (answer: string) => (_text: string, only: readonly string[]) =>
    only.includes(answer) ? answer : 'und'

  const german = 'guten morgen wie geht es dir heute'
  /** A Turkish speaker learning German, and a German speaker learning Turkish. */
  const pair = ['tr', 'de', 'de', 'tr']

  it('believes a provider that looked at this exact sentence', () => {
    // No candidate list needed: it was never a guess.
    expect(detectSpeechLanguage(german, { sourceLang: 'nl' })).toBe('nl')
    // ...but not into a language nothing can read.
    expect(
      detectSpeechLanguage(german, {
        sourceLang: 'tr',
        contextLangs: pair,
        detect: detector('deu'),
      }),
    ).toBe('de')
  })

  it('takes a detection confined to the conversation', () => {
    expect(detectSpeechLanguage(german, { contextLangs: pair, detect: detector('deu') })).toBe('de')
  })

  /*
   * The rule the Turkish case bought, and the reason the candidate list is the
   * pair's languages rather than the ones we can read. Turkish is *in* the
   * running, so it wins its own sentence — and is then dropped for want of a
   * voice, instead of the sentence being read in the nearest voice we have.
   */
  it('lets a language we cannot read win, and then refuses', () => {
    const turkish = 'bugün hava gerçekten çok güzel görünüyor'
    expect(
      detectSpeechLanguage(turkish, { contextLangs: pair, detect: detector('tur') }),
    ).toBeUndefined()
  })

  it('offers the detector both people languages, and nothing else', () => {
    const seen: string[][] = []
    detectSpeechLanguage(german, {
      contextLangs: pair,
      detect: (_text, only) => {
        seen.push([...only])
        return 'deu'
      },
    })
    expect(seen[0]?.sort()).toEqual(['deu', 'tur'])
    // Norwegian is not in the running, so it cannot be the answer.
    expect(seen[0]).not.toContain('nob')
  })

  it('will not guess between fewer than two candidates', () => {
    // One language in play means the detector answers with it whatever it is
    // handed, so there is nothing to learn from asking.
    expect(
      detectSpeechLanguage(german, { contextLangs: ['de'], detect: detector('deu') }),
    ).toBeUndefined()
    expect(
      detectSpeechLanguage(german, { contextLangs: [], detect: detector('deu') }),
    ).toBeUndefined()
    expect(SPEECH_MIN_CANDIDATES).toBe(2)
  })

  it('ignores the detector below the minimum length', () => {
    expect('hallo'.length).toBeLessThan(SPEECH_MIN_DETECT_LENGTH)
    expect(
      detectSpeechLanguage('hallo', { contextLangs: pair, detect: detector('deu') }),
    ).toBeUndefined()
  })

  it('says nothing when there is no detector, or nothing to read', () => {
    expect(detectSpeechLanguage(german, { contextLangs: pair })).toBeUndefined()
    expect(
      detectSpeechLanguage('   ', {
        sourceLang: 'de',
        contextLangs: pair,
        detect: detector('deu'),
      }),
    ).toBeUndefined()
  })
})

describe('speechDetectCandidates', () => {
  it('includes the languages we cannot read, because they have to be able to win', () => {
    const candidates = speechDetectCandidates(['tr', 'en'])
    expect(candidates).toContain('tur')
    expect(candidates).toContain('eng')
    expect(speechDetectCandidates(['ja', 'ko', 'ar'])).toEqual(
      expect.arrayContaining(['jpn', 'kor', 'arb']),
    )
  })

  it('carries the varieties a detector names where we name a language', () => {
    expect(speechDetectCandidates(['zh'])).toContain('cmn')
    expect(speechDetectCandidates(['no'])).toContain('nob')
    expect(speechDetectCandidates(['sq'])).toContain('als')
    expect(speechDetectCandidates(['fa'])).toContain('pes')
  })

  it('drops duplicates and anything no detector knows', () => {
    expect(speechDetectCandidates(['en', 'en'])).toEqual(['eng'])
    expect(speechDetectCandidates(['zz', 'ase'])).toEqual([])
  })
})

describe('speechLanguageFromIso3', () => {
  /*
   * The second half of the refusal: a code can be detected and still have no
   * voice. These four are the ones with CC BY-NC-only models.
   */
  it('drops an answer no voice reads, however confident it was', () => {
    for (const iso3 of ['tur', 'arb', 'jpn', 'kor', 'nonsense'])
      expect(speechLanguageFromIso3(iso3), iso3).toBeUndefined()
    /*
     * Chinese and Lithuanian are detectable and unreadable, which is the pair
     * of facts that has to hold together: they stay in `APP_TO_ISO3` so a
     * Chinese message can win its own sentence, and they have no voice, so it
     * loses the button rather than being read in the nearest one we ship.
     */
    expect(speechDetectCandidates(['zh'])).toContain('cmn')
    expect(speechLanguageFromIso3('cmn')).toBeUndefined()
    expect(speechLanguageFromIso3('lit')).toBeUndefined()
    expect(speechLanguageFromIso3('deu')).toBe('de')
  })
})

describe('isSpeakableLength', () => {
  it('takes a sentence up to the cap and refuses either side of it', () => {
    expect(isSpeakableLength('a')).toBe(true)
    expect(isSpeakableLength('a'.repeat(TTS_MAX_TEXT_LENGTH))).toBe(true)
    expect(isSpeakableLength('a'.repeat(TTS_MAX_TEXT_LENGTH + 1))).toBe(false)
    expect(isSpeakableLength('   ')).toBe(false)
    // Trimmed before measuring, the way the server trims before hashing.
    expect(isSpeakableLength(`  ${'a'.repeat(TTS_MAX_TEXT_LENGTH)}  `)).toBe(true)
  })
})

describe('messageSpeechSchema', () => {
  it('round-trips a reading and refuses one without a real URL', () => {
    const reading = {
      url: 'https://media.langx.io/echo/tts/de/de_DE-thorsten-medium/abc.m4a',
      voice: 'de_DE-thorsten-medium',
      lang: 'de',
      cached: true,
    }
    expect(messageSpeechSchema.parse(reading)).toEqual(reading)
    expect(messageSpeechSchema.safeParse({ ...reading, url: 'not-a-url' }).success).toBe(false)
    expect(messageSpeechSchema.safeParse({ ...reading, lang: 'zz' }).success).toBe(false)
  })
})
